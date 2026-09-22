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
import {
  brandedEmail,
  detail,
  escapeEmailHtml,
  heading,
  note,
  p,
  strong,
} from "../../common/email/email-layout";

@Injectable()
export class WorkshopRequestsService {
  private readonly logger = new Logger(WorkshopRequestsService.name);

  constructor(
    @InjectModel(WorkshopRequest.name)
    private readonly requestModel: Model<WorkshopRequestDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("WorkshopBooking")
    private readonly workshopBookingModel: Model<any>,
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
      audience: "host",
      subject: `Workshop host application received — ${event.title}`,
      preheading: "Workshop host application received",
      preview: `Your application to host ${dto.workshopName} at ${event.title} is with the organizer for review.`,
      heading: "Your application is pending approval",
      bodyHtml:
        p(`Hi ${escapeEmailHtml(dto.hostName)},`) +
        p(
          `Thanks for applying to host ${strong(dto.workshopName)} at ${strong(
            event.title,
          )}. Your application is now with the organizer for review.`,
        ) +
        p("You'll get an email as soon as it's reviewed."),
    });

    await this.sendWorkshopEmail({
      to: organizerDoc?.email,
      organizerId: dto.organizerId,
      audience: "organizer",
      subject: `New workshop host application — ${event.title}`,
      preheading: "Workshop host application",
      preview: `${dto.hostName} applied to host ${dto.workshopName} at ${event.title}.`,
      heading: "New workshop host application",
      bodyHtml:
        p(
          `${strong(dto.hostName)} applied to host ${strong(
            dto.workshopName,
          )} at ${strong(event.title)}.`,
        ) +
        p("Review it from the Workshop Requests tab in your dashboard."),
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

    const withEarnings = await this.attachEarnings(eventId, requests);
    return { success: true, data: withEarnings };
  }

  /**
   * Totals up what the organizer owes each live workshop's host from paid
   * visitor tickets — ticketsSold (seats) and amountOwed (₹/$/etc). Only
   * single-session bookings are attributed to a host; a package spans
   * multiple sessions (possibly different hosts), so package revenue isn't
   * split here and is left out of amountOwed.
   */
  private async attachEarnings(eventId: string, requests: WorkshopRequestDocument[]) {
    const sessionIds = requests
      .map((r) => r.workshopSessionId)
      .filter((id): id is string => !!id);

    const earningsBySession: Record<
      string,
      { ticketsSold: number; amountOwed: number }
    > = {};

    if (sessionIds.length > 0) {
      const bookings = await this.workshopBookingModel
        .find({
          eventId: new Types.ObjectId(eventId),
          bookingType: "session",
          sessionId: { $in: sessionIds },
          paymentStatus: "Paid",
        })
        .lean();

      for (const b of bookings as any[]) {
        const entry =
          earningsBySession[b.sessionId] ||
          (earningsBySession[b.sessionId] = { ticketsSold: 0, amountOwed: 0 });
        entry.ticketsSold += Number(b.quantity) || 0;
        entry.amountOwed += Number(b.amount) || 0;
      }
    }

    return requests.map((r) => {
      const earnings = r.workshopSessionId
        ? earningsBySession[r.workshopSessionId]
        : undefined;
      return {
        ...(r.toObject ? r.toObject() : r),
        ticketsSold: earnings?.ticketsSold || 0,
        amountOwed: earnings?.amountOwed || 0,
      };
    });
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
          audience: "host",
          subject: `Approved — hosting fee required for ${event?.title}`,
          preheading: "Workshop approved",
          preview: `Pay the hosting fee of ${fee} to confirm ${request.workshopName} at ${event?.title}.`,
          heading: "You're approved! One step left",
          bodyHtml:
            p(`Hi ${escapeEmailHtml(request.hostName)},`) +
            p(
              `Great news — the organizer approved your workshop, ${strong(
                request.workshopName,
              )}.`,
            ) +
            p(strong(`To confirm your slot, pay the hosting fee of ${fee}.`)) +
            p(
              `Sign back in on the event page with ${strong(
                request.hostEmail,
              )} to pay — your workshop goes live as soon as the organizer confirms your payment.`,
            ),
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
        audience: "host",
        subject: `Update on your workshop application — ${event?.title}`,
        preheading: "Workshop application update",
        preview: `An update on your application to host at ${event?.title}.`,
        heading: "Application update",
        bodyHtml:
          p(`Hi ${escapeEmailHtml(request.hostName)},`) +
          p(
            `Thank you for your interest in hosting at ${strong(
              event?.title,
            )}. On this occasion your application wasn't selected.`,
          ) +
          (dto.rejectionReason
            ? detail("Reason:", escapeEmailHtml(dto.rejectionReason))
            : ""),
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
      audience: "organizer",
      subject: `Hosting fee payment submitted — ${request.workshopName}`,
      preheading: "Workshop hosting fee",
      preview: `${request.hostName} says they've paid the hosting fee for ${request.workshopName}.`,
      heading: "Hosting fee payment submitted",
      bodyHtml:
        p(
          `${strong(request.hostName)} says they've paid the hosting fee for ${strong(
            request.workshopName,
          )}.`,
        ) +
        note(
          "Verify and confirm from the Workshop Requests tab to publish their workshop.",
        ),
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
      audience: "host",
      subject: `Your workshop is live — ${event.title}`,
      preheading: "Workshop published",
      preview: `${request.workshopName} is now published on ${event.title} and visitors can book it.`,
      heading: "Your workshop is live",
      bodyHtml:
        p(`Hi ${escapeEmailHtml(request.hostName)},`) +
        p(
          `${strong(request.workshopName)} is now published on ${strong(
            event.title,
          )} and visitors can book it.`,
        ),
    });

    this.logger.log(`Workshop request ${request._id} finalized and published`);

    return {
      success: true,
      message: "Workshop published to the event.",
      data: request,
    };
  }

  // ============ EMAIL / WHATSAPP HELPERS ============

  // The organizer's custom sender config, plus the name and address a
  // host-facing email is signed with and points questions to.
  private async senderFor(organizerId: any): Promise<{
    senderConfig?: any;
    name?: string;
    email?: string;
  }> {
    try {
      const org: any = await this.organizerModel
        .findById(organizerId)
        .select("emailConfig organizationName name email")
        .lean();
      return {
        senderConfig: org?.emailConfig,
        name: org?.organizationName || org?.name,
        email: org?.email,
      };
    } catch {
      return {};
    }
  }

  // Host-facing emails go out on the organizer's behalf — signed by them, with
  // the footer's help link pointing at their address. The organizer's own
  // notifications come from the platform.
  private async sendWorkshopEmail(opts: {
    to?: string;
    organizerId: any;
    audience: "host" | "organizer";
    subject: string;
    preheading?: string;
    preview?: string;
    heading: string;
    bodyHtml: string;
  }) {
    if (!opts.to) return false;
    try {
      const sender = await this.senderFor(opts.organizerId);
      const onBehalf = opts.audience === "host";
      await this.mailService.sendEmail({
        to: opts.to,
        subject: opts.subject,
        html: brandedEmail({
          preheading: opts.preheading,
          preview: opts.preview,
          body: heading(opts.heading) + opts.bodyHtml,
          organizer: onBehalf ? sender.name : undefined,
          contact:
            onBehalf && sender.email
              ? {
                  label: `contact ${sender.name || "the organizer"}`,
                  href: `mailto:${sender.email}`,
                }
              : undefined,
        }),
        senderConfig: sender.senderConfig,
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
