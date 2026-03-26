import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Res,
} from "@nestjs/common";
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

  // Get all requests for an organizer
  @Get("organizer/:organizerId")
  async findByOrganizer(@Param("organizerId") organizerId: string) {
    return this.service.findByOrganizer(organizerId);
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
    @Body() body: { notes?: string },
  ) {
    return this.service.confirmPayment(id, body?.notes);
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
