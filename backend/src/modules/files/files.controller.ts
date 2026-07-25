import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

/**
 * On-the-fly image download/convert.
 *
 * Everything is stored as .webp (see WebpValidationPipe). Organizers viewing a
 * vendor's images in the stall dialog can download any of them as a PNG or JPG
 * — this endpoint reads the stored .webp and converts it on the fly, forcing a
 * browser download via Content-Disposition. The file on disk is never changed.
 */
@Controller("files")
export class FilesController {
  // Mirror main.ts's defensive uploads-dir resolution so this works whether
  // the compiled entrypoint lives at dist/main.js or dist/src/main.js.
  private resolveUploadsDir(): string {
    const atCwd = path.join(process.cwd(), "uploads");
    const nearDist = path.join(__dirname, "..", "..", "..", "uploads");
    if (fs.existsSync(atCwd)) return atCwd;
    if (fs.existsSync(nearDist)) return nearDist;
    return atCwd;
  }

  @Get("download")
  async download(
    @Query("path") relPath: string,
    @Query("format") format: string,
    @Res() res: Response,
  ) {
    if (!relPath) throw new BadRequestException("path is required");

    const fmt =
      format === "jpg" || format === "jpeg" ? "jpeg" : ("png" as const);

    const uploadsDir = path.resolve(this.resolveUploadsDir());

    // Accept either a public "/uploads/…" URL path or a bare relative path,
    // then resolve it INSIDE the uploads dir and reject any traversal.
    const cleaned = relPath
      .replace(/^https?:\/\/[^/]+/i, "") // strip an accidental absolute URL
      .replace(/^\/?uploads\//i, "")
      .replace(/^\/+/, "");
    const resolved = path.resolve(uploadsDir, cleaned);
    const rel = path.relative(uploadsDir, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new ForbiddenException("Invalid path");
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new NotFoundException("File not found");
    }

    let pipeline = sharp(resolved);
    if (fmt === "jpeg") {
      // JPEG has no alpha — flatten transparency onto white so logos/docs
      // don't come out with a black background.
      pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 92 });
    } else {
      pipeline = pipeline.png();
    }

    let buffer: Buffer;
    try {
      buffer = await pipeline.toBuffer();
    } catch {
      throw new BadRequestException("File is not a convertible image");
    }

    const ext = fmt === "jpeg" ? "jpg" : "png";
    const base = path.basename(cleaned).replace(/\.[^.]+$/, "") || "image";
    res.set({
      "Content-Type": fmt === "jpeg" ? "image/jpeg" : "image/png",
      "Content-Disposition": `attachment; filename="${base}.${ext}"`,
      "Cache-Control": "no-store",
    });
    res.send(buffer);
  }
}
