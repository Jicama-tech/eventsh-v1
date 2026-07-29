import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { SpeakerRequestsService } from "./speaker-requests.service";
import {
  CreateSpeakerRequestDto,
  UpdateSpeakerRequestStatusDto,
  UpdateSpeakerFeeDto,
  ConfirmSessionTimesDto,
} from "./dto/create-speaker-request.dto";

@Controller("speaker-requests")
export class SpeakerRequestsController {
  constructor(private readonly service: SpeakerRequestsService) {}

  // Phase 1: Apply as speaker
  @Post("apply")
  @HttpCode(HttpStatus.CREATED)
  async apply(@Body() body: any) {
    if (typeof body.sessions === "string")
      body.sessions = JSON.parse(body.sessions);
    if (typeof body.socialLinks === "string")
      body.socialLinks = JSON.parse(body.socialLinks);
    return this.service.create(body);
  }

  // Phase 1b: Apply as speaker with image upload
  @Post("apply-with-image")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("image", {
      storage: diskStorage({
        destination: "./uploads/speakers",
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error("Only image files are allowed!"), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async applyWithImage(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    if (typeof body.sessions === "string")
      body.sessions = JSON.parse(body.sessions);
    if (typeof body.socialLinks === "string")
      body.socialLinks = JSON.parse(body.socialLinks);
    if (file) {
      body.image = `/uploads/speakers/${file.filename}`;
    }
    return this.service.create(body);
  }

  // Get all requests for an organizer
  @Get("organizer/:organizerId")
  async findByOrganizer(@Param("organizerId") organizerId: string) {
    return this.service.findByOrganizer(organizerId);
  }

  // ===== PERSISTENT SPEAKER PROFILES (the reusable roster) =====
  // Declared BEFORE @Get(":id") so "profiles" isn't swallowed as an id.

  /**
   * One speaker's saved profile, looked up by their (Google-verified) email.
   * The eventfront calls this right after sign-in to prefill step 1, so a
   * returning speaker never retypes their bio, role or company.
   */
  @Get("profiles/by-email/:email")
  async findSpeakerProfile(
    @Param("email") email: string,
    @Query("organizerId") organizerId?: string,
  ) {
    return this.service.findSpeakerProfile(email, organizerId);
  }

  /** The organizer's whole speaker roster, reusable on future events. */
  // Guarded: the roster carries contact numbers and organizer-private notes.
  @UseGuards(AuthGuard("jwt"))
  @Get("profiles/organizer/:organizerId")
  async findSpeakerProfiles(@Param("organizerId") organizerId: string) {
    return this.service.findSpeakersByOrganizer(organizerId);
  }

  /**
   * Add or edit a speaker in the CRM by hand — the organizer building their
   * roster directly instead of waiting for someone to apply. Multipart so the
   * headshot can come with it; `id` in the body switches this to an edit.
   */
  @Post("profiles")
  // Guarded: writes into the organizer's own CRM.
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileInterceptor("image", {
      storage: diskStorage({
        destination: "./uploads/speakers",
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error("Only image files are allowed!"), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async saveSpeakerProfile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (typeof body.socialLinks === "string") {
      try {
        body.socialLinks = JSON.parse(body.socialLinks);
      } catch {
        body.socialLinks = undefined;
      }
    }
    if (file) body.image = `/uploads/speakers/${file.filename}`;
    return this.service.saveSpeakerProfile(body);
  }

  /**
   * One speaker's full history with this organizer: the events they've been
   * on the line-up for, and every application they've made.
   */
  @UseGuards(AuthGuard("jwt"))
  @Get("profiles/:id/history")
  async getSpeakerHistory(@Param("id") id: string) {
    return this.service.getSpeakerHistory(id);
  }

  @UseGuards(AuthGuard("jwt"))
  @Delete("profiles/:id")
  async removeSpeakerProfile(@Param("id") id: string) {
    return this.service.removeSpeakerProfile(id);
  }

  // Get all requests for an event
  @Get("event/:eventId")
  async findByEvent(@Param("eventId") eventId: string) {
    return this.service.findByEvent(eventId);
  }

  // Check if email already applied
  @Get("check/:eventId/:email")
  async checkExisting(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
  ) {
    return this.service.checkExisting(eventId, email);
  }

  // Stats for organizer
  @Get("stats/:organizerId")
  async getStats(@Param("organizerId") organizerId: string) {
    return this.service.getStats(organizerId);
  }

  // Get attendance
  @Get(":id/attendance")
  async getAttendance(@Param("id") id: string) {
    return this.service.getAttendance(id);
  }

  // Download speaker pass PDF
  @Get("download-speaker-pass/:id")
  async downloadPass(@Param("id") id: string, @Res() res: Response) {
    try {
      const { buffer, filename } = await this.service.downloadSpeakerPass(id);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      });
      res.end(buffer);
    } catch (error) {
      res.status(404).json({ success: false, message: error.message || "Speaker pass not found" });
    }
  }

  // Get single request
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  // Phase 2: Update status (approve/reject/cancel)
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSpeakerRequestStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }

  // Phase 2b: Select time slot (after approval)
  @Patch(":id/select-time-slot")
  async selectTimeSlot(
    @Param("id") id: string,
    @Body() dto: ConfirmSessionTimesDto,
  ) {
    return this.service.selectTimeSlot(id, dto);
  }

  // Set fee
  @Patch(":id/fee")
  async updateFee(
    @Param("id") id: string,
    @Body() dto: UpdateSpeakerFeeDto,
  ) {
    return this.service.updateFee(id, dto);
  }

  // Update payment status
  @Patch(":id/payment-status")
  async updatePaymentStatus(
    @Param("id") id: string,
    @Body() body: { paymentStatus: string; notes?: string },
  ) {
    return this.service.updatePaymentStatus(id, body.paymentStatus, body.notes);
  }

  // Phase 3: Confirm payment → generates QR + PDF + WhatsApp
  @Patch(":id/confirm-payment")
  async confirmPayment(
    @Param("id") id: string,
    // changedBy names the operator (or "Organizer") for the approval trail.
    @Body() body: { notes?: string; changedBy?: string },
  ) {
    return this.service.confirmPayment(id, body?.notes, body?.changedBy);
  }

  // QR Scan - check-in/check-out
  @Post("scan-qr")
  @HttpCode(HttpStatus.OK)
  async scanQR(@Body() body: { qrCodeData: string }) {
    return this.service.scanSpeakerQR(body.qrCodeData);
  }

  // Generate pass for organizer-added speaker
  @Post("generate-pass/:eventId")
  @HttpCode(HttpStatus.OK)
  async generatePass(
    @Param("eventId") eventId: string,
    @Body() speaker: any,
  ) {
    return this.service.generatePassForEventSpeaker(eventId, speaker);
  }

  // Delete request
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
