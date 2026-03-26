import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as puppeteer from "puppeteer";
import {
  SpeakerRequest,
  SpeakerRequestDocument,
} from "./entities/speaker-request.entity";
import {
  CreateSpeakerRequestDto,
  UpdateSpeakerRequestStatusDto,
  UpdateSpeakerFeeDto,
  ConfirmSessionTimesDto,
} from "./dto/create-speaker-request.dto";
import { OtpService } from "../otp/otp.service";

@Injectable()
export class SpeakerRequestsService {
  private readonly logger = new Logger(SpeakerRequestsService.name);

  constructor(
    @InjectModel(SpeakerRequest.name)
    private speakerRequestModel: Model<SpeakerRequestDocument>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private otpService: OtpService,
  ) {
    const ticketsDir = path.join(process.cwd(), "uploads", "speakerTickets");
    if (!fs.existsSync(ticketsDir))
      fs.mkdirSync(ticketsDir, { recursive: true });
  }

  // ============ PHASE 1: APPLY AS SPEAKER ============
  async create(dto: CreateSpeakerRequestDto) {
    try {
      const event = await this.eventModel.findById(dto.eventId);
      if (!event) throw new NotFoundException("Event not found");

      if (dto.email) {
        const existing = await this.speakerRequestModel.findOne({
          eventId: new Types.ObjectId(dto.eventId),
          email: dto.email,
          status: { $nin: ["Cancelled", "Rejected"] },
        });
        if (existing) {
          throw new ConflictException(
            "You already have a pending or approved speaker application for this event",
          );
        }
      }

      const request = await this.speakerRequestModel.create({
        ...dto,
        eventId: new Types.ObjectId(dto.eventId),
        organizerId: new Types.ObjectId(dto.organizerId),
        status: "Pending",
        paymentStatus: "Waived",
        source: dto.source || "external",
        statusHistory: [
          {
            status: "Pending",
            note: "Application submitted",
            changedAt: new Date(),
            changedBy: dto.source === "organizer" ? "organizer" : "applicant",
          },
        ],
      });

      const populated = await request.populate([
        { path: "eventId", select: "title location startDate time endTime" },
        { path: "organizerId", select: "name email organizationName whatsAppNumber" },
      ]);

      // Send WhatsApp to speaker
      await this.sendWhatsAppNotification(
        dto.phone,
        `🎤 *Speaker Application Submitted*\n\n` +
        `Dear ${dto.name},\n\n` +
        `Your speaker application for *${event.title}* has been submitted successfully.\n\n` +
        `📋 *Event:* ${event.title}\n` +
        `📍 *Location:* ${event.location || "TBD"}\n` +
        `📅 *Date:* ${new Date(event.startDate).toLocaleDateString()}\n\n` +
        `Your application is now pending organizer approval.\n` +
        `You will receive a notification once it's reviewed.\n\n` +
        `Thank you! 🙏`,
      );

      return {
        success: true,
        message: "Speaker application submitted successfully",
        data: populated,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      this.logger.error("Error creating speaker request:", error);
      throw new BadRequestException(error.message);
    }
  }

  // ============ PHASE 2: UPDATE STATUS (APPROVE / REJECT / CANCEL) ============
  async updateStatus(id: string, dto: UpdateSpeakerRequestStatusDto) {
    try {
      if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid ID");

      const request = await this.speakerRequestModel
        .findById(id)
        .populate("eventId")
        .populate("organizerId");
      if (!request) throw new NotFoundException("Speaker request not found");

      const updateData: any = {
        status: dto.status,
        $push: {
          statusHistory: {
            status: dto.status,
            note: dto.notes || `Status changed to ${dto.status}`,
            changedAt: new Date(),
            changedBy: dto.changedBy || "organizer",
          },
        },
      };

      if (dto.status === "Confirmed") {
        updateData.confirmationDate = new Date();
      }

      if (dto.status === "Rejected") {
        updateData.rejectionDate = new Date();
        updateData.organizerNotes = dto.rejectionReason || dto.notes;
      }

      const updated = await this.speakerRequestModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .populate([
          { path: "eventId", select: "title location startDate time endTime" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      const event: any = updated.eventId;

      // WhatsApp notifications
      if (dto.status === "Confirmed") {
        await this.sendWhatsAppNotification(
          request.phone,
          `✅ *Speaker Application Approved!*\n\n` +
          `Congratulations ${request.name}!\n\n` +
          `Your speaker application for *${event?.title}* has been approved.\n\n` +
          `📋 *Next Steps:*\n` +
          `1. Select your preferred session time slot\n` +
          `2. Complete payment (if applicable)\n` +
          `3. Receive your speaker pass with QR code\n\n` +
          `Please visit the event page to select your time slot. 🎉`,
        );
      } else if (dto.status === "Rejected") {
        await this.sendWhatsAppNotification(
          request.phone,
          `❌ *Speaker Application Update*\n\n` +
          `Dear ${request.name},\n\n` +
          `Your speaker application for *${event?.title}* was not selected.\n\n` +
          `${dto.rejectionReason ? `Reason: ${dto.rejectionReason}\n\n` : ""}` +
          `Please contact the organizer for more information.\n` +
          `Thank you for your interest. 🙏`,
        );
      } else if (dto.status === "Cancelled") {
        await this.sendWhatsAppNotification(
          request.phone,
          `⚠️ *Speaker Slot Cancelled*\n\n` +
          `Dear ${request.name},\n\n` +
          `Your speaker slot for *${event?.title}* has been cancelled.\n\n` +
          `Please contact the organizer for more details.`,
        );
      }

      return {
        success: true,
        message: `Speaker request ${dto.status.toLowerCase()} successfully`,
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new BadRequestException(error.message);
    }
  }

  // ============ PHASE 2b: SELECT TIME SLOT (After approval) ============
  async selectTimeSlot(id: string, dto: ConfirmSessionTimesDto) {
    try {
      const request = await this.speakerRequestModel.findById(id).populate("eventId");
      if (!request) throw new NotFoundException("Speaker request not found");

      if (request.status !== "Confirmed") {
        throw new BadRequestException("Speaker must be approved before selecting a time slot");
      }

      request.sessions = dto.sessions.map((s) => ({
        topic: s.topic,
        description: s.description,
        confirmedStartTime: s.confirmedStartTime,
        confirmedEndTime: s.confirmedEndTime,
      }));

      request.status = "Processing";
      request.statusHistory.push({
        status: "Processing" as any,
        note: "Time slot selected, pending payment",
        changedAt: new Date(),
        changedBy: "speaker",
      });

      await request.save();

      const event: any = request.eventId;
      await this.sendWhatsAppNotification(
        request.phone,
        `📅 *Time Slot Selected*\n\n` +
        `Dear ${request.name},\n\n` +
        `Your session for *${event?.title}* has been scheduled.\n\n` +
        `📋 *Session Details:*\n` +
        dto.sessions.map((s) =>
          `• ${s.topic}: ${s.confirmedStartTime} - ${s.confirmedEndTime}`
        ).join("\n") +
        `\n\n${request.isCharged && request.fee > 0 ? `💰 Payment of ${request.fee} is required to confirm.\n\n` : "✅ This is a free session slot - no payment required.\n\n"}` +
        `Thank you! 🎤`,
      );

      return {
        success: true,
        message: "Time slot selected successfully",
        data: request,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new BadRequestException(error.message);
    }
  }

  // ============ SET FEE ============
  async updateFee(id: string, dto: UpdateSpeakerFeeDto) {
    try {
      const request = await this.speakerRequestModel.findById(id);
      if (!request) throw new NotFoundException("Speaker request not found");

      request.isCharged = dto.isCharged;
      request.fee = dto.isCharged ? dto.fee || 0 : 0;
      request.paymentStatus = dto.isCharged ? "Unpaid" : "Waived";
      if (dto.notes) request.organizerNotes = dto.notes;

      await request.save();

      return {
        success: true,
        message: dto.isCharged ? `Fee of ${dto.fee} set for speaker` : "Speaker slot marked as free",
        data: request,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // ============ PHASE 3: CONFIRM PAYMENT → GENERATE QR + PDF ============
  async confirmPayment(id: string, notes?: string) {
    try {
      if (!Types.ObjectId.isValid(id)) throw new BadRequestException("Invalid ID");

      const request = await this.speakerRequestModel
        .findById(id)
        .populate("eventId")
        .populate("organizerId");
      if (!request) throw new NotFoundException("Speaker request not found");

      // Generate QR payload
      const qrPayload = {
        warning: "❌ Normal scanners not allowed. Please use the EventSH app.",
        type: "eventsh-speaker-checkin",
        speakerRequestId: id,
        eventId: (request.eventId as any)._id.toString(),
        speakerName: request.name,
        issuedAt: new Date().toISOString(),
      };

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200,
        margin: 2,
      });

      // Update request
      request.paymentStatus = "Paid";
      request.paymentDate = new Date();
      request.status = "Completed";
      request.qrCodePath = qrCodeBase64;
      request.qrCodeData = JSON.stringify(qrPayload);
      request.statusHistory.push({
        status: "Completed" as any,
        note: notes || "Payment confirmed. Speaker pass issued.",
        changedAt: new Date(),
        changedBy: "organizer",
      });

      await request.save();

      // Add speaker to event's speakers array
      await this.addSpeakerToEvent(request);

      // Generate PDF ticket
      const pdfBuffer = await this.generateSpeakerTicketPDF(request, qrCodeBase64);
      const pdfDir = path.join(process.cwd(), "uploads", "speakerTickets");
      const pdfFileName = `speaker_pass_${id}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      request.qrCodePath = `/uploads/speakerTickets/${pdfFileName}`;
      await request.save();

      // Send via WhatsApp
      const event: any = request.eventId;
      const eventDate = new Date(event.startDate).toLocaleDateString();

      await this.sendWhatsAppNotification(
        request.phone,
        `🎉 *Your Speaker Pass is Ready!*\n\n` +
        `🎤 *Speaker:* ${request.name}\n` +
        `📅 *Event:* ${event.title}\n` +
        `📍 *Date:* ${eventDate}\n` +
        `📍 *Venue:* ${event.location || "TBD"}\n\n` +
        `📊 *Session:*\n` +
        (request.sessions || []).map((s: any) =>
          `• ${s.topic}: ${s.confirmedStartTime || s.preferredStartTime} - ${s.confirmedEndTime || s.preferredEndTime}`
        ).join("\n") +
        `\n\n⚠️ Your speaker pass PDF is attached.\n` +
        `The QR code can ONLY be scanned using the official EventSH app.\n\n` +
        `Thank you for speaking at our event! 🎊`,
      );

      // Send PDF
      try {
        await this.otpService.sendMediaMessage(
          request.phone,
          pdfPath,
          `🎤 Your speaker pass for ${event.title}`,
        );
      } catch (err) {
        this.logger.warn("Could not send PDF via WhatsApp:", err);
      }

      return {
        success: true,
        message: "Payment confirmed. Speaker pass sent via WhatsApp.",
        data: request,
      };
    } catch (error) {
      this.logger.error("Error confirming speaker payment:", error);
      throw error;
    }
  }

  // ============ QR SCAN - CHECK-IN / CHECK-OUT ============
  async scanSpeakerQR(qrCodeData: string) {
    try {
      const qrData = JSON.parse(qrCodeData);

      if (qrData.type !== "eventsh-speaker-checkin") {
        throw new BadRequestException("Invalid QR code type");
      }

      const request = await this.speakerRequestModel
        .findById(qrData.speakerRequestId)
        .populate("eventId");
      if (!request) throw new NotFoundException("Speaker pass not found");

      const storedQr = JSON.parse(request.qrCodeData || "{}");
      if (storedQr.speakerRequestId !== qrData.speakerRequestId) {
        throw new BadRequestException("Invalid QR code");
      }

      const now = new Date();

      // First scan - Check-in
      if (!request.hasCheckedIn) {
        request.checkInTime = now;
        request.hasCheckedIn = true;
        await request.save();

        await this.sendWhatsAppNotification(
          request.phone,
          `✅ *Check-in Successful*\n\n` +
          `Welcome ${request.name}!\n` +
          `Check-in time: ${now.toLocaleString()}\n\n` +
          `Your session is confirmed. Have a great presentation! 🎤`,
        );

        return {
          success: true,
          message: "Speaker check-in successful",
          data: {
            action: "CHECK_IN",
            speakerName: request.name,
            checkInTime: now,
            sessions: request.sessions,
          },
        };
      }

      // Second scan - Check-out
      if (request.hasCheckedIn && !request.hasCheckedOut) {
        request.checkOutTime = now;
        request.hasCheckedOut = true;
        await request.save();

        const duration = Math.floor((now.getTime() - request.checkInTime.getTime()) / (1000 * 60));

        await this.sendWhatsAppNotification(
          request.phone,
          `👋 *Check-out Successful*\n\n` +
          `Thank you ${request.name}!\n` +
          `Check-out: ${now.toLocaleString()}\n` +
          `Duration: ${duration} minutes\n\n` +
          `Thank you for your amazing session! 🙏`,
        );

        return {
          success: true,
          message: "Speaker check-out successful",
          data: {
            action: "CHECK_OUT",
            speakerName: request.name,
            checkInTime: request.checkInTime,
            checkOutTime: now,
            duration,
          },
        };
      }

      throw new BadRequestException("Speaker has already checked out");
    } catch (error) {
      this.logger.error("Error scanning speaker QR:", error);
      throw error;
    }
  }

  // ============ DOWNLOAD SPEAKER PASS ============
  async downloadSpeakerPass(id: string) {
    try {
      const request = await this.speakerRequestModel
        .findById(id)
        .populate("eventId")
        .populate("organizerId");
      if (!request) throw new NotFoundException("Speaker request not found");

      if (request.paymentStatus !== "Paid" && request.paymentStatus !== "Waived") {
        throw new BadRequestException("Speaker pass only available after payment confirmation");
      }

      if (request.status !== "Completed") {
        throw new BadRequestException("Speaker pass only available after completion");
      }

      const pdfFileName = `speaker_pass_${id}.pdf`;
      const pdfDir = path.join(process.cwd(), "uploads", "speakerTickets");
      const pdfPath = path.join(pdfDir, pdfFileName);

      if (fs.existsSync(pdfPath)) {
        const buffer = await fs.promises.readFile(pdfPath);
        return { buffer, filename: pdfFileName };
      }

      // Regenerate if missing
      const qrPayload = request.qrCodeData
        ? JSON.parse(request.qrCodeData)
        : { type: "eventsh-speaker-checkin", speakerRequestId: id };

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), { width: 200, margin: 2 });
      const pdfBuffer = await this.generateSpeakerTicketPDF(request, qrCodeBase64);

      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      return { buffer: pdfBuffer, filename: pdfFileName };
    } catch (error) {
      this.logger.error("Error downloading speaker pass:", error);
      throw error;
    }
  }

  // ============ QUERIES ============
  async findByEvent(eventId: string) {
    const requests = await this.speakerRequestModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .populate([
        { path: "eventId", select: "title location startDate time endTime" },
        { path: "organizerId", select: "name email organizationName" },
      ])
      .sort({ createdAt: -1 });
    return { success: true, data: requests };
  }

  async findByOrganizer(organizerId: string) {
    const requests = await this.speakerRequestModel
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .populate([{ path: "eventId", select: "title location startDate" }])
      .sort({ createdAt: -1 });
    return { success: true, data: requests };
  }

  async findOne(id: string) {
    const request = await this.speakerRequestModel
      .findById(id)
      .populate([
        { path: "eventId", select: "title location startDate time endTime" },
        { path: "organizerId", select: "name email organizationName" },
      ]);
    if (!request) throw new NotFoundException("Speaker request not found");
    return { success: true, data: request };
  }

  async checkExisting(eventId: string, email: string) {
    const existing = await this.speakerRequestModel.findOne({
      eventId: new Types.ObjectId(eventId),
      email,
      status: { $nin: ["Cancelled", "Rejected"] },
    });
    return { success: true, exists: !!existing, data: existing };
  }

  async getStats(organizerId: string) {
    const requests = await this.speakerRequestModel.find({
      organizerId: new Types.ObjectId(organizerId),
    });
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "Pending").length,
      confirmed: requests.filter((r) => r.status === "Confirmed").length,
      processing: requests.filter((r) => r.status === "Processing").length,
      completed: requests.filter((r) => r.status === "Completed").length,
      rejected: requests.filter((r) => r.status === "Rejected").length,
      totalRevenue: requests
        .filter((r) => r.paymentStatus === "Paid")
        .reduce((sum, r) => sum + r.fee, 0),
    };
  }

  async getAttendance(id: string) {
    const request = await this.speakerRequestModel
      .findById(id)
      .select("name checkInTime checkOutTime hasCheckedIn hasCheckedOut sessions");
    if (!request) throw new NotFoundException("Speaker request not found");
    return {
      success: true,
      data: {
        name: request.name,
        checkInTime: request.checkInTime,
        checkOutTime: request.checkOutTime,
        hasCheckedIn: request.hasCheckedIn,
        hasCheckedOut: request.hasCheckedOut,
      },
    };
  }

  async updatePaymentStatus(id: string, paymentStatus: string, notes?: string) {
    const request = await this.speakerRequestModel.findById(id);
    if (!request) throw new NotFoundException("Speaker request not found");

    if (paymentStatus === "Paid") {
      return this.confirmPayment(id, notes);
    }

    request.paymentStatus = paymentStatus;
    request.statusHistory.push({
      status: request.status as any,
      note: notes || `Payment status changed to ${paymentStatus}`,
      changedAt: new Date(),
      changedBy: "organizer",
    });
    await request.save();

    return { success: true, message: "Payment status updated", data: request };
  }

  // Generate pass for organizer-added speaker (no application flow needed)
  async generatePassForEventSpeaker(eventId: string, speaker: any) {
    try {
      const event = await this.eventModel.findById(eventId);
      if (!event) throw new NotFoundException("Event not found");

      // Check if a request already exists for this speaker
      let request = await this.speakerRequestModel.findOne({
        eventId: new Types.ObjectId(eventId),
        name: speaker.name,
        source: "organizer",
      });

      if (request && request.qrCodePath) {
        return { success: true, message: "Pass already exists", data: request };
      }

      if (!request) {
        request = await this.speakerRequestModel.create({
          eventId: new Types.ObjectId(eventId),
          organizerId: event.organizer,
          name: speaker.name,
          email: speaker.email || "",
          phone: speaker.whatsAppNumber || "",
          title: speaker.title || speaker.agenda || "",
          organization: speaker.companyName || speaker.organization || "",
          bio: speaker.bio || speaker.description || "",
          socialLinks: speaker.socialLinks || {},
          sessions: (speaker.slots || speaker.sessions || []).map((s: any) => ({
            topic: s.topic || s.agenda || speaker.name,
            confirmedStartTime: s.startTime || s.confirmedStartTime || "",
            confirmedEndTime: s.endTime || s.confirmedEndTime || "",
            description: s.description || "",
          })),
          status: "Completed",
          paymentStatus: "Waived",
          source: "organizer",
          isKeynote: speaker.isKeynote || false,
          statusHistory: [{
            status: "Completed",
            note: "Added by organizer, pass auto-generated",
            changedAt: new Date(),
            changedBy: "organizer",
          }],
        });
      }

      // Generate QR
      const qrPayload = {
        warning: "Use EventSH app to scan.",
        type: "eventsh-speaker-checkin",
        speakerRequestId: request._id.toString(),
        eventId,
        speakerName: speaker.name,
        issuedAt: new Date().toISOString(),
      };

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), { width: 200, margin: 2 });

      request.qrCodePath = qrCodeBase64;
      request.qrCodeData = JSON.stringify(qrPayload);
      request.status = "Completed";
      await request.save();

      // Generate PDF
      const pdfBuffer = await this.generateSpeakerTicketPDF(request, qrCodeBase64);
      const pdfDir = path.join(process.cwd(), "uploads", "speakerTickets");
      const pdfFileName = `speaker_pass_${request._id}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      request.qrCodePath = `/uploads/speakerTickets/${pdfFileName}`;
      await request.save();

      return { success: true, message: "Speaker pass generated", data: request };
    } catch (error) {
      this.logger.error("Error generating pass for event speaker:", error);
      throw error;
    }
  }

  async remove(id: string) {
    const request = await this.speakerRequestModel.findByIdAndDelete(id);
    if (!request) throw new NotFoundException("Speaker request not found");
    return { success: true, message: "Speaker request deleted" };
  }

  // ============ PRIVATE: PDF GENERATION ============
  private async generateSpeakerTicketPDF(request: any, qrBase64: string): Promise<Buffer> {
    const event: any = request.eventId;
    const eventDate = new Date(event?.startDate).toLocaleDateString();

    const html = `<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 15px; background: #f5f5f5; font-size: 11px; }
  .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { text-align: center; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #7c3aed; margin: 0; }
  .header p { color: #666; margin: 5px 0 0; }
  .event-title { font-size: 20px; font-weight: bold; margin: 15px 0; text-align: center; }
  .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 11px; }
  .section-title { font-size: 12px; color: #7c3aed; font-weight: bold; text-transform: uppercase; margin: 15px 0 8px; border-bottom: 2px solid #7c3aed; display: inline-block; }
  .qr-section { text-align: center; margin: 20px 0; }
  .qr-section img { width: 180px; height: 180px; }
  .session-item { background: #f8f5ff; padding: 8px; border-radius: 6px; margin: 5px 0; border-left: 3px solid #7c3aed; }
  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; font-size: 10px; color: #856404; }
  .footer { text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; margin-top: 15px; }
</style></head>
<body><div class="container">
  <div class="header">
    <h1>EVENTSH SPEAKER PASS</h1>
    <p>Your speaking session has been confirmed</p>
  </div>
  <div class="event-title">${event?.title || "Event"}</div>
  <div class="section-title">Speaker Details</div>
  <div class="detail-row"><span>Name:</span><span>${request.name}</span></div>
  ${request.title ? `<div class="detail-row"><span>Title:</span><span>${request.title}</span></div>` : ""}
  ${request.organization ? `<div class="detail-row"><span>Organization:</span><span>${request.organization}</span></div>` : ""}
  ${request.email ? `<div class="detail-row"><span>Email:</span><span>${request.email}</span></div>` : ""}
  <div class="section-title">Event Information</div>
  <div class="detail-row"><span>📅 Date:</span><span>${eventDate}</span></div>
  <div class="detail-row"><span>📍 Venue:</span><span>${event?.location || "TBD"}</span></div>
  ${(request.sessions || []).length > 0 ? `
    <div class="section-title">Sessions</div>
    ${request.sessions.map((s: any) => `
      <div class="session-item">
        <strong>${s.topic}</strong><br>
        ${s.confirmedStartTime || s.preferredStartTime ? `Time: ${s.confirmedStartTime || s.preferredStartTime} - ${s.confirmedEndTime || s.preferredEndTime}` : ""}
        ${s.description ? `<br><small>${s.description}</small>` : ""}
      </div>
    `).join("")}
  ` : ""}
  <div class="qr-section">
    <p style="font-weight:bold; color:#7c3aed; font-size:14px;">Your Speaker QR Code</p>
    <p style="font-size:10px; color:#666;">Scan at Event Entrance</p>
    <img src="${qrBase64}" alt="Speaker QR Code">
  </div>
  <div class="warning">⚠️ <strong>Important:</strong> Use the official EventSH App to scan QR code for Check-In and Check-Out.</div>
  <div class="footer">© ${new Date().getFullYear()} EventSH. All rights reserved.</div>
</div></body></html>`;

    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfUint8 = await page.pdf({ format: "A4", printBackground: true, margin: { top: "10mm", bottom: "0mm", left: "0mm", right: "0mm" } });
    await browser.close();
    return Buffer.from(pdfUint8);
  }

  // ============ PRIVATE: ADD SPEAKER TO EVENT ============
  private async addSpeakerToEvent(request: SpeakerRequestDocument) {
    try {
      const event = await this.eventModel.findById(request.eventId);
      if (!event) return;

      const speakers = event.speakers || [];
      const filtered = speakers.filter((s: any) => s.requestId !== request._id.toString());

      const slots = (request.sessions || []).map((s: any) => ({
        topic: s.topic,
        startTime: s.confirmedStartTime || s.preferredStartTime || "",
        endTime: s.confirmedEndTime || s.preferredEndTime || "",
        description: s.description || "",
      }));

      filtered.push({
        id: `req-${request._id}`,
        requestId: request._id.toString(),
        name: request.name,
        title: request.title || "",
        organization: request.organization || "",
        bio: request.bio || "",
        image: request.image || "",
        email: request.email || "",
        socialLinks: request.socialLinks || {},
        slots,
        isKeynote: request.isKeynote || false,
        order: filtered.length,
      });

      await this.eventModel.findByIdAndUpdate(request.eventId, { speakers: filtered });
    } catch (error) {
      this.logger.error("Error adding speaker to event:", error);
    }
  }

  // ============ PRIVATE: WHATSAPP HELPER ============
  private async sendWhatsAppNotification(phone: string, message: string) {
    if (!phone) return;
    try {
      await this.otpService.sendWhatsAppMessage(phone, message);
    } catch (err) {
      this.logger.warn("WhatsApp notification failed:", err);
    }
  }
}
