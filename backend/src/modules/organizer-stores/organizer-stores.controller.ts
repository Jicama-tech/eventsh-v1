import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { OrganizerStoresService } from "./organizer-stores.service";
import { CreateOrganizerStoreDto } from "./dto/create-organizer-store.dto";
import { UpdateOrganizerStoreDto } from "./dto/update-organizer-store.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthGuard } from "@nestjs/passport";
import { diskStorage } from "multer";
import * as path from "path";
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from "@nestjs/platform-express";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import { WebpValidationPipe } from "../../seed/parse-webp.pipe";

// Ensure uploads directory exists
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Multer storage configuration for banner uploads
const storage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads/banners";
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

@Controller("organizer-stores")
export class OrganizerStoresController {
  constructor(
    private readonly organizerStoresService: OrganizerStoresService,
  ) {}

  @Post("add-store-settings")
  // @UseGuards(AuthGuard("jwt"))
  create(@Body() createOrganizerStoreDto: CreateOrganizerStoreDto) {
    try {
      return this.organizerStoresService.create(createOrganizerStoreDto);
    } catch (error) {
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.organizerStoresService.findAll();
  }

  @Get("organizer-store-detail")
  @UseGuards(AuthGuard("jwt"))
  findOne(@Req() req: any) {
    try {
      const id = req.user.userId;
      return this.organizerStoresService.findOneByorganizerId(id);
    } catch (error) {
      throw error;
    }
  }

  @Get("organizer-store-detail/:id")
  async findById(@Param("id") id: string) {
    try {
      return await this.organizerStoresService.findOneByorganizerId(id);
    } catch (error) {
      throw error;
    }
  }

  @Get("organizer-stores-detail/:organizationName")
  findOneById(@Param("organizationName") organizationName: string) {
    try {
      return this.organizerStoresService.findBySlug(organizationName);
    } catch (error) {
      throw error;
    }
  }

  @Patch("update-store-settings")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "bannerImage", maxCount: 1 },
        { name: "heroBannerImage", maxCount: 1 },
        { name: "aboutUsImage", maxCount: 1 },
      ],
      {
        storage,
        fileFilter: (req, file, cb) => {
          if (file.mimetype.startsWith("image/")) {
            cb(null, true);
          } else {
            cb(new Error("Only image files allowed"), false);
          }
        },
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      },
    ),
  )
  async update(
    @Req() req: any,
    @UploadedFiles(WebpValidationPipe)
    files: {
      bannerImage?: Express.Multer.File[];
      heroBannerImage?: Express.Multer.File[];
      aboutUsImage?: Express.Multer.File[];
    },
    @Body() updateOrganizerStoreDto: UpdateOrganizerStoreDto,
  ) {
    try {
      const id = req.user.userId;


      // Parse JSON string fields from multipart body
      Object.keys(updateOrganizerStoreDto).forEach((key) => {
        if (typeof updateOrganizerStoreDto[key] === "string") {
          try {
            const parsed = JSON.parse(updateOrganizerStoreDto[key]);
            (updateOrganizerStoreDto as any)[key] = parsed;
          } catch (parseError) {
            // Keep the original value if parsing fails
          }
        }
      });

      // Handle bannerImage (0 or 1 file)
      let bannerImagePath: string | undefined;
      if (files.bannerImage && files.bannerImage.length > 0) {
        bannerImagePath = `/uploads/banners/${files.bannerImage[0].filename}`;
      }

      // Handle heroBannerImage (0 or 1 file)
      let heroBannerImagePath: string | undefined;
      if (files.heroBannerImage && files.heroBannerImage.length > 0) {
        heroBannerImagePath = `/uploads/banners/${files.heroBannerImage[0].filename}`;
      }

      let aboutUsImagePath: string | undefined;
      if (files.aboutUsImage && files.aboutUsImage.length > 0) {
        aboutUsImagePath = `/uploads/banners/${files.aboutUsImage[0].filename}`;
      }

      // Call service with parsed DTO and optional file paths
      return await this.organizerStoresService.update(
        id,
        updateOrganizerStoreDto,
        bannerImagePath, // undefined if no file
        heroBannerImagePath, // undefined if no file
        aboutUsImagePath, // undefined if no file
      );
    } catch (error) {
      throw error;
    }
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.organizerStoresService.remove(+id);
  }
}
