// src/seed/parse-webp.pipe.ts
import { PipeTransform, Injectable, BadRequestException } from "@nestjs/common";
import * as path from "path";
import * as sharp from "sharp";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class WebpValidationPipe implements PipeTransform {
  async transform(value: any) {
    if (!value) return value;

    // SCENARIO 1: Array of files (Products 'images' field)
    if (Array.isArray(value)) {
      for (const file of value) {
        await this.processFile(file);
      }
    }
    // SCENARIO 2: Object of arrays (Banners from shopkeeper controller)
    else if (typeof value === "object" && !value.buffer) {
      for (const key of Object.keys(value)) {
        if (Array.isArray(value[key])) {
          for (const file of value[key]) {
            await this.processFile(file);
          }
        }
      }
    }
    // SCENARIO 3: Single file
    else if (value.buffer) {
      await this.processFile(value);
    }

    return value;
  }

  private async processFile(file: any) {
    if (!file.buffer) return;

    // Folder Logic
    const folderMap: Record<string, string> = {
      images: "products",
      bannerImage: "banners",
      heroBannerImage: "banners",
      eventImage: "events",
    };

    const subFolder = folderMap[file.fieldname] || "misc";
    const uploadDir = `./uploads/${subFolder}`;

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate .webp filename
    const uniqueName = `${file.fieldname}-${Date.now()}-${uuidv4()}.webp`;
    const fullPath = path.join(uploadDir, uniqueName);

    // Convert and Save to Disk
    await sharp(file.buffer)
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(fullPath);

    // OVERWRITE Multer's filename so the Controller sees the .webp name
    file.filename = uniqueName;
    file.path = fullPath;
  }
}
