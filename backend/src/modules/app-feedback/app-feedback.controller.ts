import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { AppFeedbackService } from "./app-feedback.service";
import {
  RequestOtpDto,
  SubmitAppFeedbackDto,
  SubmitSupportDto,
  UpdateAppFeedbackDto,
} from "./dto/app-feedback.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

// Mirrors the events controller filter — accepts the same set the rest of
// the platform allows for image uploads.
const supportImageFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/^image\/(jpe?g|png|gif|webp|avif)$/)) {
    cb(new Error("Only image files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

@Controller("app-feedback")
export class AppFeedbackController {
  constructor(private readonly service: AppFeedbackService) {}

  // ─── Public submission flow ────────────────────────────────────────────
  @Post("request-otp")
  async requestOtp(@Body() body: RequestOtpDto) {
    return this.service.requestOtp(body.email);
  }

  @Post()
  async submit(@Body() body: SubmitAppFeedbackDto) {
    return this.service.submit(body);
  }

  // ─── Organizer support tickets (JWT-authenticated) ─────────────────────
  // Multipart endpoint so the frontend can attach up to 5 screenshots in
  // the same request as the text fields. JWT identity is the source of
  // truth for who submitted the ticket — we never read name/email from
  // the body.
  @Post("support")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor("attachments", 5, {
      storage: diskStorage({
        destination: "./uploads/support",
        filename: (_req, file, cb) => {
          cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
        },
      }),
      fileFilter: supportImageFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    }),
  )
  async submitSupport(
    @UploadedFiles() files: Express.Multer.File[] = [],
    @Body() body: SubmitSupportDto,
    @Req() req: any,
  ) {
    const attachmentUrls = (files || []).map(
      (f) => `/uploads/support/${f.filename}`,
    );
    return this.service.submitSupport({
      userId: req?.user?.sub,
      email: req?.user?.email,
      name: req?.user?.organizationName || req?.user?.name,
      dto: body,
      attachmentUrls,
    });
  }

  @Get("support/my")
  @UseGuards(JwtAuthGuard)
  async listMySupport(@Req() req: any) {
    return this.service.listMySupport(req?.user?.sub);
  }

  // ─── Public read endpoints — power the landing page ────────────────────
  @Get("featured")
  async getFeatured() {
    return this.service.getFeatured();
  }

  @Get("stats")
  async getStats() {
    return this.service.getStats();
  }

  // ─── Super-admin curation. JwtAuthGuard matches the existing admin
  // module's pattern; only admin/super-admin JWTs reach the dashboard. ───
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query("filter")
    filter:
      | "all"
      | "pending"
      | "featured"
      | "hidden"
      | "support" = "pending",
  ) {
    return this.service.listAll(filter);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Param("id") id: string,
    @Body() patch: UpdateAppFeedbackDto,
    @Req() req: any,
  ) {
    return this.service.update(id, patch, req?.user?.sub);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
