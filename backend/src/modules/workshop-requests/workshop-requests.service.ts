import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  eventHasEnded,
  EVENT_ENDED_MESSAGE,
} from "../../common/event-timing.util";
import {
  WorkshopRequest,
  WorkshopRequestDocument,
  WorkshopRequestStatus,
} from "./entities/workshop-request.entity";
import {
  CreateWorkshopRequestDto,
  UpdateWorkshopRequestStatusDto,
  UpdateWorkshopHostingFeeDto,
  UpdateWorkshopProposalDto,
} from "./dto/create-workshop-request.dto";
import { OtpService } from "../otp/otp.service";
import { MailService } from "../roles/mail.service";

@Injectable()
export class WorkshopRequestsService {
  private readonly logger = new Logger(WorkshopRequestsService.name);

  constructor(
    @InjectModel(WorkshopRequest.name)
    private readonly requestModel: Model<WorkshopRequestDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}

  // ============ PHASE 1: APPLY TO HOST ============
  async create(dto: CreateWorkshopRequestDto) {
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new NotFoundException("Event not found");
    if (eventHasEnded(event)) {
      throw new BadRequestException(EVENT_ENDED_MESSAGE);
    }
    if (!event.workshopHostingOpen) {
      throw new BadRequestException(
        "This event isn't accepting workshop host applications right now",
      );
    }

    const email = String(dto.hostEmail || "").trim().toLowerCase();
    if (email) {
      const existing = await this.requestModel.findOne({
        eventId: new Types.ObjectId(dto.eventId),
        hostEmail: email,
        status: { $nin: ["Cancelled", "Rejected"] },
      });
      if (existing) {
        throw new ConflictException(
          "You already have a pending or approved workshop application for this event",
        );
      }
    }

    const proposedPrice = Number(dto.proposedPrice) || 0;

    const request = await this.requestModel.create({
      ...dto,
      hostEmail: email,
      eventId: new Types.ObjectId(dto.eventId),
      organizerId: new Types.ObjectId(dto.organizerId),
      status: WorkshopRequestStatus.Pending,
      proposedPrice,
      finalPrice: proposedPrice,
      maxSeats: Number(dto.maxSeats) || 0,
      statusHistory: [
        {
          status: WorkshopRequestStatus.Pending,
          note: "Application submitted",
          changedAt: new Date(),
          changedBy: "applicant",
        },
      ],
    });

    const organizerDoc = await this.organizerModel.findById(dto.organizerId);

    await this.sendWhatsAppNotification(
      dto.hostPhone,
      `*Workshop Host Application Submitted*\n\n` +
        `Dear ${dto.hostName},\n\n` +
        `Your application to host "${dto.workshopName}" at *${event.title}* has been submitted and is pending organizer approval.`,
    );

    await this.sendWorkshopEmail({
      to: email,
      organizerId: dto.organizerId,
      subject: `Workshop host application received — ${event.title}`,
      heading: "Your application is pending approval",
      accent: "linear-gradient(135deg,#f59e0b,#d97706)",
      bodyHtml: `
        <p style="margin:0 0 12px">Hi ${dto.hostName},</p>
        <p style="margin:0 0 12px">Thanks for applying to host <strong>${dto.workshopName}</strong> at <strong>${event.title}</strong>. Your application is now with the organizer for review.</p>
        <p style="margin:0;color:#475569">You'll get an email as soon as it's reviewed.</p>`,
    });

    await this.sendWorkshopEmail({
      to: organizerDoc?.email,
      organizerId: dto.organizerId,
      subject: `New workshop host application — ${event.title}`,
      heading: "New workshop host application",
      bodyHtml: `
        <p style="margin:0 0 12px"><strong>${dto.hostName}</strong> applied to host <strong>${dto.workshopName}</strong> at <strong>${event.title}</strong>.</p>
        <p style="margin:0;color:#475569">Review it from the Workshop Requests tab in your dashboard.</p>`,
    });

    return {
      success: true,
      message: "Workshop host application submitted successfully",
      data: request,
    };
  }

  async findByEvent(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event ID");
    }
    const requests = await this.requestModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .sort({ createdAt: -1 });
    return { success: true, data: requests };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request ID");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Workshop request not found");
    return { success: true, data: request };
  }

  // ============ PHASE 2: APPROVE / REJECT ============
  async updateStatus(id: string, dto: UpdateWorkshopRequestStatusDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request ID");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Workshop request not found");

    request.status = dto.status as WorkshopRequestStatus;
    request.statusHistory.push({
      status: dto.status as WorkshopRequestStatus,
      note:
        dto.notes ||
        (dto.status === "Confirmed"
          ? "Application approved"
          : dto.status === "Rejected"
            ? `Application rejected${dto.rejectionReason ? `: ${dto.rejectionReason}` : ""}`
            : `Status changed to ${dto.status}`),
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    });

    if (dto.status === "Confirmed") request.confirmationDate = new Date();
    if (dto.status === "Rejected") {
      request.rejectionDate = new Date();
      request.organizerNotes = dto.rejectionReason || dto.notes;
    }
    await request.save();

    const event = await this.eventModel.findById(request.eventId);

    if (dto.status === "Confirmed") {
      const fee = Number(request.hostingFee) || 0;
      const isPaidHosting = !!request.isCharged && fee > 0;

      if (isPaidHosting) {
        await this.sendWorkshopEmail({
          to: request.hostEmail,
          organizerId: request.organizerId,
          subject: `Approved — hosting fee required for ${event?.title}`,
          heading: "You're approved! One step left",
          accent: "linear-gradient(135deg,#3b82f6,#6366f1)",
          bodyHtml: `
            <p style="margin:0 0 12px">Hi ${request.hostName},</p>
            <p style="margin:0 0 12px">Great news — the organizer approved your workshop, <strong>${request.workshopName}</strong>.</p>
            <p style="margin:0 0 12px"><strong>To confirm your slot, pay the hosting fee of ${fee}.</strong></p>
            <p style="margin:0;color:#475569">Sign back in on the event page with <strong>${request.hostEmail}</strong> to pay — your workshop goes live as soon as the organizer confirms your payment.</p>`,
        });
      } else {
        try {
          await this.finalizeWorkshopRequest(
            request,
            dto.changedBy || "Organizer",
          );
        } catch (err) {
          this.logger.error(
            `Auto-finalize of workshop request ${request._id} failed: ${(err as any)?.message || err}`,
          );
        }
      }
    } else if (dto.status === "Rejected") {
      await this.sendWorkshopEmail({
        to: request.hostEmail,
        organizerId: request.organizerId,
        subject: `Update on your workshop application — ${event?.title}`,
        heading: "Application update",
        accent: "linear-gradient(135deg,#64748b,#475569)",
        bodyHtml: `
          <p style="margin:0 0 12px">Hi ${request.hostName},</p>
          <p style="margin:0 0 12px">Thank you for your interest in hosting at <strong>${event?.title}</strong>. On this occasion your application wasn't selected.</p>
          ${dto.rejectionReason ? `<p style="margin:0 0 12px"><strong>Reason:</strong> ${dto.rejectionReason}</p>` : ""}`,
      });
    }

    return {
      success: true,
      message: `Workshop request ${dto.status.toLowerCase()} successfully`,
      data: request,
    };
  }

  // ============ SET HOSTING FEE ============
  async updateFee(id: string, dto: UpdateWorkshopHostingFeeDto) {
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Workshop request not found");

    request.isCharged = dto.isCharged;
    request.hostingFee = dto.isCharged ? dto.fee || 0 : 0;
    request.paymentStatus = dto.isCharged ? "Unpaid" : "Waived";
    if (dto.notes) request.organizerNotes = dto.notes;
    await request.save();

    return {
      success: true,
      message: dto.isCharged
        ? `Hosting fee of ${dto.fee} set`
        : "Hosting marked as free",
      data: request,
    };
  }

  // ============ ADJUST PROPOSAL (before going live) ============
  async updateProposal(id: string, dto: UpdateWorkshopProposalDto) {
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Workshop request not found");
    if (request.status === "Completed") {
      throw new BadRequestException(
        "This workshop is already live — edit it from the Workshops tab instead",
      );
    }

    if (dto.workshopName !== undefined) request.workshopName = dto.workshopName;
    if (dto.workshopDescription !== undefined)
      request.workshopDescription = dto.workshopDescription;
    if (dto.finalPrice !== undefined) request.finalPrice = dto.finalPrice;
    if (dto.maxSeats !== undefined) request.maxSeats = dto.maxSeats;
    if (dto.proposedStartTime !== undefined)
      request.proposedStartTime = dto.proposedStartTime;
    if (dto.proposedEndTime !== undefined)
      request.proposedEndTime = dto.proposedEndTime;
    await request.save();

    return { success: true, message: "Proposal updated", data: request };
  }

  // ============ HOST SELF-REPORTS "I'VE PAID" ============
  // Applicant-facing, informational only — flags the payment for the
  // organizer to verify. Does NOT publish the workshop; only the
  // organizer-triggered confirmPayment() below does that. Mirrors Speaker
  // Requests' updatePaymentStatus (self-report) vs confirmPayment
  // (organizer-gated pass issuance) split exactly.
  async markPaymentSubmitted(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request ID");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Workshop request not found");
    if (!request.isCharged || request.status !== "Confirmed") {
      throw new BadRequestException(
        "This request has no pending hosting-fee payment",
      );
    }

    request.paymentStatus = "Paid";
    await request.save();

    const organizerDoc = await this.organizerModel.findById(
      request.organizerId,
    );
    await this.sendWorkshopEmail({
      to: organizerDoc?.email,
      organizerId: request.organizerId,
      subject: `Hosting fee payment submitted — ${request.workshopName}`,
      heading: "Hosting fee payment submitted",
      bodyHtml: `
        <p style="margin:0 0 12px"><strong>${request.hostName}</strong> says they've paid the hosting fee for <strong>${request.workshopName}</strong>.</p>
        <p style="margin:0;color:#475569">Verify and confirm from the Workshop Requests tab to publish their workshop.</p>`,
    });

    return {
      success: true,
      message:
        "Payment marked as submitted. The organizer will verify and publish your workshop.",
      data: request,
    };
  }

  // ============ PHASE 3: ORGANIZER CONFIRMS PAYMENT → GO LIVE ============
  async confirmPayment(id: string, notes?: string, changedBy?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request ID");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Workshop request not found");

    request.paymentStatus = "Paid";
    request.paymentDate = new Date();
    await request.save();

    return this.finalizeWorkshopRequest(
      request,
      changedBy || "Organizer",
      notes,
    );
  }

  /**
   * The single convergence point both the free-approval path and the paid
   * hosting-fee-confirmation path funnel into — pushes a new WorkshopSession
   * onto the event, exactly matching the shape CreateEventForm/the visitor
   * booking flow already read and write. Mirrors Speaker Requests'
   * issueSpeakerPass / addSpeakerToEvent, minus the QR pass (out of scope).
   */
  private async finalizeWorkshopRequest(
    request: WorkshopRequestDocument,
    changedBy?: string,
    note?: string,
  ) {
    const event = await this.eventModel.findById(request.eventId);
    if (!event) throw new NotFoundException("Event not found");

    const sessionId = `wsreq-${request._id}`;
    const sessions: any[] = event.workshopSessions || [];
    const filtered = sessions.filter((s: any) => s.id !== sessionId);
    filtered.push({
      id: sessionId,
      requestId: request._id.toString(),
      name: request.workshopName,
      description: request.workshopDescription || "",
      image: request.hostImage || "",
      price: Number(request.finalPrice) || 0,
      facilitator: request.hostName,
      startTime: request.proposedStartTime || "",
      endTime: request.proposedEndTime || "",
      maxSeats: Number(request.maxSeats) || 0,
      bookedSeats: 0,
      order: filtered.length,
    });
    event.workshopSessions = filtered;
    event.markModified("workshopSessions");
    await event.save();

    request.status = WorkshopRequestStatus.Completed;
    request.workshopSessionId = sessionId;
    request.statusHistory.push({
      status: WorkshopRequestStatus.Completed,
      note: note || "Workshop published to the event.",
      changedAt: new Date(),
      changedBy: changedBy || "System",
    });
    await request.save();

    await this.sendWhatsAppNotification(
      request.hostPhone,
      `*Your Workshop is Live!*\n\n` +
        `"${request.workshopName}" is now published on *${event.title}* and open for bookings.`,
    );

    await this.sendWorkshopEmail({
      to: request.hostEmail,
      organizerId: request.organizerId,
      subject: `Your workshop is live — ${event.title}`,
      heading: "Your workshop is live",
      accent: "linear-gradient(135deg,#22c55e,#16a34a)",
      bodyHtml: `
        <p style="margin:0 0 12px">Hi ${request.hostName},</p>
        <p style="margin:0 0 12px"><strong>${request.workshopName}</strong> is now published on <strong>${event.title}</strong> and visitors can book it.</p>`,
    });

    this.logger.log(`Workshop request ${request._id} finalized and published`);

    return {
      success: true,
      message: "Workshop published to the event.",
      data: request,
    };
  }

  // ============ EMAIL / WHATSAPP HELPERS ============

  private async senderConfigFor(organizerId: any) {
    try {
      const org = await this.organizerModel
        .findById(organizerId)
        .select("emailConfig")
        .lean();
      return (org as any)?.emailConfig;
    } catch {
      return undefined;
    }
  }

  private async sendWorkshopEmail(opts: {
    to?: string;
    organizerId: any;
    subject: string;
    heading: string;
    bodyHtml: string;
    accent?: string;
  }) {
    if (!opts.to) return false;
    try {
      const senderConfig = await this.senderConfigFor(opts.organizerId);
      await this.mailService.sendEmail({
        to: opts.to,
        subject: opts.subject,
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:${opts.accent || "linear-gradient(135deg,#6366f1,#4f46e5)"};color:#fff;padding:24px;text-align:center">
          <h1 style="margin:0;font-size:20px">${opts.heading}</h1>
        </div>
        <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.7">
          ${opts.bodyHtml}
        </div>
      </div>`,
        senderConfig,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Workshop email "${opts.subject}" to ${opts.to} failed: ${(err as any)?.message || err}`,
      );
      return false;
    }
  }

  private async sendWhatsAppNotification(phone?: string, message?: string) {
    if (!phone || !message) return;
    try {
      await this.otpService.sendWhatsAppMessage(phone, message);
    } catch {
      // Best-effort — WhatsApp is a secondary channel, email is primary.
    }
  }
}
