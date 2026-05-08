import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { AuthGuard } from "@nestjs/passport";
import { VenueDesignerService } from "./venue-designer.service";

@Controller("venue-designer")
export class VenueDesignerController {
  constructor(private readonly designer: VenueDesignerService) {}

  @Post("generate")
  @UseGuards(AuthGuard("jwt"))
  async generate(@Body() body: any) {
    return this.designer.generate(body);
  }

  @Post("chat")
  @UseGuards(AuthGuard("jwt"))
  async chat(@Body() body: any) {
    return this.designer.chat(body);
  }

  @Post("chat-vision")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("blueprint", {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) {
          cb(new Error("Only PNG, JPG, or WEBP blueprints are allowed."), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async chatVision(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    if (!file) throw new BadRequestException("blueprint image is required.");

    // Multipart bodies arrive as strings — JSON-decode the rich fields.
    const parseField = (raw: any) => {
      if (raw == null) return undefined;
      if (typeof raw !== "string") return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    return this.designer.chatVision({
      messages: parseField(body.messages) || [],
      wallMargin: body.wallMargin != null ? Number(body.wallMargin) : undefined,
      stallGap: body.stallGap != null ? Number(body.stallGap) : undefined,
      stallOrientation: body.stallOrientation,
      venueConfig: parseField(body.venueConfig),
      templates: parseField(body.templates) || {},
      blueprint: { buffer: file.buffer, mimeType: file.mimetype },
    });
  }
}
