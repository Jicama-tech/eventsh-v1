import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as QRCode from "qrcode";
import * as puppeteer from "puppeteer";
import { RegisterScheduledSpaceDto } from "./dto/register.dto";
import { SelectSlotsDto } from "./dto/select-slots.dto";
import { ConfirmScheduledSpacePaymentDto } from "./dto/confirm-payment.dto";
import { UpdateScheduledSpaceStatusDto } from "./dto/update-status.dto";
import {
  ScheduledSpaceRequest,
  ScheduledSpaceRequestDocument,
  ScheduledSpaceStatusEnum,
} from "./entities/scheduled-space-request.entity";
import { MailService } from "../roles/mail.service";
import { OperatorsService } from "../operators/operators.service";

// A visitor may have any number of Scheduled Space requests for the same
// event over time (mirrors stalls.service.ts's vendor-request model), but
// only one *live* one at once — these are the statuses that count as
// "done with," so a new registration is allowed once the prior request
// lands in one of them.
const TERMINAL_STATUSES = [
  ScheduledSpaceStatusEnum.Completed,
  ScheduledSpaceStatusEnum.Cancelled,
  ScheduledSpaceStatusEnum.Rejected,
];

@Injectable()
export class ScheduledSpacesService {
  private readonly logger = new Logger(ScheduledSpacesService.name);

  constructor(
    @InjectModel(ScheduledSpaceRequest.name)
    private requestModel: Model<ScheduledSpaceRequestDocument>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private mailService: MailService,
    private operatorsService: OperatorsService,
  ) {}

  // A visitor registers and is immediately confirmed — no organizer approval
  // gate to pass before picking a space & slot. The organizer's role starts
  // at payment confirmation instead (see confirmPayment below).
  //
  // A visitor may submit any number of requests for the same event over
  // its lifetime — mirrors stalls.service.ts's createStallRequest — but
  // only one *live* (non-terminal) one at a time, so this only blocks a
  // second registration while a prior one is still Pending/Confirmed/
  // Processing.
  async register(dto: RegisterScheduledSpaceDto) {
    if (!Types.ObjectId.isValid(String(dto.eventId))) {
      throw new BadRequestException("Invalid event id");
    }
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new NotFoundException("Event not found");

    const existingActive = await this.requestModel.findOne({
      eventId: new Types.ObjectId(String(dto.eventId)),
      email: dto.email,
      status: { $nin: TERMINAL_STATUSES },
    });
    if (existingActive) {
      throw new ConflictException(
        "You already have an active Scheduled Space request for this event.",
      );
    }

    const request = new this.requestModel({
      eventId: new Types.ObjectId(String(dto.eventId)),
      organizerId: new Types.ObjectId(String(dto.organizerId)),
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      whatsappNumber: dto.whatsappNumber,
      facilityTypeRequested: dto.facilityTypeRequested,
      purpose: dto.purpose,
      organization: dto.organization,
      referralCode: dto.referralCode?.trim()
        ? dto.referralCode.trim().toUpperCase()
        : undefined,
      companions: (dto.companions || []).filter((c) => c && c.trim()),
      status: ScheduledSpaceStatusEnum.Confirmed,
      statusHistory: [{ status: ScheduledSpaceStatusEnum.Confirmed }],
    });
    await request.save();
    return { success: true, data: request };
  }

  // The visitor-side "have I already registered" check, keyed by email
  // since this module has no vendor-account system. Mirrors
  // stalls.service.ts's checkExistingRequest: returns every request this
  // email has ever made for this event (unfiltered by status, newest
  // first) in `requests`, plus the most recent one in `data` for callers
  // that only care about the single-request shape. An empty/null result is
  // a normal, expected outcome for a first-time visitor, not an error.
  async checkExistingRequest(eventId: string, email: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event id");
    }
    const requests = await this.requestModel
      .find({ eventId: new Types.ObjectId(eventId), email })
      .sort({ createdAt: -1 });
    return { success: true, data: requests[0] || null, requests };
  }

  // Placed instances with their template-defined slots, annotated with
  // which (positionId, slotId) tokens are already reserved. Mirrors
  // stalls.service.ts's getAvailableTables, but per-slot rather than
  // per-whole-space.
  async getAvailableSpaces(eventId: string, referralCode?: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event id");
    }
    const event = await this.eventModel.findById(eventId);
    if (!event) throw new NotFoundException("Event not found");

    // Resolve the referral code (if any) to an operator scoped to this
    // event's organizer. A referral code is a *filter*, not an access
    // gate: with no code (or one that doesn't match anything), every
    // space shows — public and every operator's alike. Only once a code
    // resolves to a specific operator does the list narrow to that
    // operator's spaces plus the unassigned/public ones.
    let matchedOperator: { id: string; name: string } | null = null;
    if (referralCode?.trim()) {
      const operator = await this.operatorsService.findByReferralCode(
        String(event.organizer),
        referralCode,
      );
      if (operator) {
        matchedOperator = { id: String(operator._id), name: operator.name };
      }
    }

    const bookedTokens = new Set<string>(event.scheduledSpaceBookedSlots || []);

    const spaces = (event.venueScheduledSpaces || [])
      .map((space: any) => (space?.toObject ? space.toObject() : space))
      .filter(
        (s: any) =>
          !matchedOperator || !s.operatorId || s.operatorId === matchedOperator.id,
      )
      .map((s: any) => {
        const slots = (s.slots || []).map((slot: any) => ({
          ...slot,
          isBooked: bookedTokens.has(`${s.positionId}:${slot.id}`),
        }));
        return { ...s, slots };
      });

    return {
      success: true,
      data: {
        spaces,
        venueConfig: event.venueConfig,
        matchedOperator,
        referralCodeInvalid: !!referralCode?.trim() && !matchedOperator,
      },
    };
  }

  // Phase 2 — registrant picks one or more (space, slot) pairs and submits
  // payment proof. Reserves every token atomically in one update — if ANY
  // token is already taken the whole update is rejected (no partial holds),
  // mirroring the same $nin/$push technique tickets.service.ts uses for
  // seatMapBookedSeats.
  async selectSlots(requestId: string, dto: SelectSlotsDto) {
    if (!Types.ObjectId.isValid(requestId)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(requestId);
    if (!request) throw new NotFoundException("Request not found");
    if (request.status !== ScheduledSpaceStatusEnum.Confirmed) {
      throw new BadRequestException(
        "This registration hasn't been approved by the organizer yet.",
      );
    }
    if (!dto.selectedSlots || dto.selectedSlots.length === 0) {
      throw new BadRequestException("Select at least one space and slot.");
    }

    const event = await this.eventModel.findById(request.eventId);
    if (!event) throw new NotFoundException("Event not found");

    // Resolve every selected slot against the event's ACTUAL placed
    // instances — price/name/date/time are never trusted from the client.
    const resolved: any[] = [];
    for (const sel of dto.selectedSlots) {
      const space = (event.venueScheduledSpaces || []).find(
        (s: any) => s.positionId === sel.positionId,
      );
      if (!space) {
        throw new BadRequestException(
          `Space ${sel.positionId} no longer exists on this event.`,
        );
      }
      const slot = (space.slots || []).find((s: any) => s.id === sel.slotId);
      if (!slot) {
        throw new BadRequestException(
          `Slot ${sel.slotId} no longer exists on space "${space.name}".`,
        );
      }
      resolved.push({
        positionId: sel.positionId,
        templateId: sel.templateId,
        slotId: sel.slotId,
        spaceName: space.name,
        facilityType: space.facilityType,
        slotLabel: slot.label,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        price: space.price || 0,
      });
    }

    const tokens = resolved.map((r) => `${r.positionId}:${r.slotId}`);

    // Atomic reservation — succeeds only if NONE of the tokens are already
    // in the ledger. A modifiedCount of 0 means at least one slot was taken
    // out from under this registrant by a concurrent request.
    const result = await this.eventModel.updateOne(
      { _id: event._id, scheduledSpaceBookedSlots: { $nin: tokens } },
      { $push: { scheduledSpaceBookedSlots: { $each: tokens } } },
    );
    if (!result.modifiedCount) {
      throw new BadRequestException(
        "One or more selected slots are no longer available. Please pick again.",
      );
    }

    const slotsTotal = resolved.reduce((sum, r) => sum + (r.price || 0), 0);

    request.selectedSlots = resolved as any;
    request.slotsTotal = slotsTotal;

    // Free/charity spaces (organizer never set a price) skip straight past
    // the payment-proof UI on the frontend — there's nothing to pay — but
    // still land in Processing like a paid booking: the organizer approves
    // every slot selection themselves (via confirmPayment/completeBooking),
    // free or not. Only paidAmount/paymentStatus differ (0/"Paid" here vs.
    // whatever was actually collected for a paid space).
    const paidAmount = slotsTotal === 0 ? 0 : dto.paidAmount || 0;
    request.paidAmount = paidAmount;
    request.remainingAmount = Math.max(0, slotsTotal - paidAmount);
    // paidAmount(0) >= slotsTotal(0) would otherwise read "Paid" for a free
    // space that's still sitting in Processing awaiting the organizer's
    // approval — misleading on the organizer's request list, which shows
    // this column separately from Status. completeBooking() is what
    // actually marks it "Paid", once the organizer approves.
    request.paymentStatus =
      paidAmount >= slotsTotal && slotsTotal > 0
        ? "Paid"
        : paidAmount > 0
          ? "Partial"
          : "Unpaid";
    request.transactionId = dto.transactionId || null;
    request.transactionScreenshot = dto.transactionScreenshot || null;
    request.paymentMethod = dto.paymentMethod || null;
    request.notes = dto.notes;
    request.status = ScheduledSpaceStatusEnum.Processing;
    request.statusHistory.push({
      status: ScheduledSpaceStatusEnum.Processing,
      note:
        slotsTotal === 0
          ? "Slots selected — free space, awaiting organizer approval"
          : "Slots selected, awaiting organizer payment confirmation",
      changedAt: new Date(),
    } as any);
    await request.save();

    return { success: true, data: request };
  }

  // Phase 3 — organizer confirms payment; issues the QR check-in ticket.
  async confirmPayment(dto: ConfirmScheduledSpacePaymentDto) {
    if (!Types.ObjectId.isValid(dto.requestId)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(dto.requestId);
    if (!request) throw new NotFoundException("Request not found");
    if (!request.selectedSlots || request.selectedSlots.length === 0) {
      throw new BadRequestException(
        "No slots have been selected for this request yet.",
      );
    }

    await this.completeBooking(request, {
      notes: dto.notes,
      changedBy: dto.changedBy,
    });

    return { success: true, data: request };
  }

  // Shared terminal step for both a paid booking (organizer confirms
  // payment) and a free one (slot selection completes it automatically):
  // generates the check-in QR, marks the request Completed/Paid, and
  // emails the ticket. `paidAmount` is taken from slotsTotal — for a free
  // request that's 0, which is correct (nothing was owed).
  private async completeBooking(
    request: ScheduledSpaceRequestDocument,
    opts?: { notes?: string; changedBy?: string; historyNote?: string },
  ): Promise<void> {
    const qrPayload = {
      type: "eventsh-scheduled-space-checkin",
      requestId: String(request._id),
      eventId: String(request.eventId),
      issuedAt: new Date().toISOString(),
    };
    const qrCodeImage = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 200,
      margin: 2,
    });

    request.status = ScheduledSpaceStatusEnum.Completed;
    request.paymentStatus = "Paid";
    request.paidAmount = request.slotsTotal;
    request.remainingAmount = 0;
    request.qrCodeData = JSON.stringify(qrPayload);
    request.qrCodeImage = qrCodeImage;
    request.notes = opts?.notes ?? request.notes;
    request.statusHistory.push({
      status: ScheduledSpaceStatusEnum.Completed,
      note: opts?.historyNote ?? opts?.notes,
      changedBy: opts?.changedBy,
      changedAt: new Date(),
    } as any);
    await request.save();

    // Best-effort — the ticket is still viewable from the event page even if
    // the email fails to send, so never let delivery break the confirmation.
    this.emailTicket(request, qrCodeImage).catch((err) =>
      this.logger.warn(
        `Ticket email failed for scheduled-space request ${request._id}: ${
          (err as any)?.message || err
        }`,
      ),
    );
  }

  // Emails the registrant their check-in QR ticket + booking summary once
  // the organizer confirms payment (or resends it later). Uses the
  // organizer's custom SMTP sender when configured, same as every other
  // outbound email in the app. Attaches a rendered PDF copy of the ticket;
  // if headless Chromium fails (constrained prod hosts have hit this
  // before — see /tmp permission issues), falls back to the plain HTML
  // email with the QR inline rather than blocking delivery entirely.
  private async emailTicket(
    request: ScheduledSpaceRequestDocument,
    qrCodeImage: string,
    opts?: { reissue?: boolean },
  ) {
    const isReissue = !!opts?.reissue;
    const [event, organizer] = await Promise.all([
      this.eventModel.findById(request.eventId).select("title"),
      this.organizerModel
        .findById(request.organizerId)
        .select("emailConfig organizationName country"),
    ]);

    // Same convention as every other backend-sent price (see
    // sponsors.service.ts): SG → SG$, everything else → ₹.
    const currency = organizer?.country === "SG" ? "SG$" : "₹";

    const rows = (request.selectedSlots || [])
      .map(
        (s: any) => `
        <tr>
          <td style="padding:6px 14px;color:#334155">${s.spaceName}${
            s.facilityType ? ` (${s.facilityType})` : ""
          }</td>
          <td style="padding:6px 14px;color:#334155">${s.date} ${s.startTime}-${s.endTime}</td>
          <td style="padding:6px 14px;font-weight:600;text-align:right">${currency}${s.price}</td>
        </tr>`,
      )
      .join("");

    const heading = isReissue
      ? "Here's your ticket again 🎟️"
      : "Booking confirmed 🎟️";

    // The QR is embedded via a CID attachment, not a data: URI — most email
    // clients (Outlook, many corporate filters, some Gmail configs) strip
    // inline base64 <img> sources for security, which was leaving the QR
    // as a broken image in the email body even though the PDF (rendered
    // directly by Chromium, no email client involved) always showed it fine.
    const qrCid = `qr-${request._id}`;
    const qrBase64 = qrCodeImage.replace(/^data:image\/\w+;base64,/, "");

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="margin-bottom:4px">${heading}</h2>
        <p>Hi ${request.name},</p>
        <p>
          Your payment for <strong>${event?.title || "the event"}</strong> has
          been confirmed. Here is your check-in QR ticket — please show this
          at the venue. A PDF copy is attached.
        </p>
        ${
          request.whatsappNumber
            ? `<p style="margin:4px 0"><span style="color:#64748b">WhatsApp:</span> <strong>${request.whatsappNumber}</strong></p>`
            : ""
        }
        ${
          request.referralCode
            ? `<p style="margin:4px 0"><span style="color:#64748b">Referral Code:</span> <strong>${request.referralCode}</strong></p>`
            : ""
        }
        <table style="border-collapse:collapse;width:100%;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:6px 14px;text-align:left">Space</th>
              <th style="padding:6px 14px;text-align:left">Time Slot</th>
              <th style="padding:6px 14px;text-align:right">Price</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="text-align:center;margin:24px 0">
          <img src="cid:${qrCid}" alt="Check-in QR" style="width:180px;height:180px;border:1px solid #e2e8f0;border-radius:8px;padding:8px" />
        </p>
        <p style="color:#64748b;font-size:12px;margin-bottom:2px">— ${organizer?.organizationName || "EventSH"}</p>
        <p style="color:#94a3b8;font-size:11px;margin-top:0">Powered by EventSH</p>
      </div>`;

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await this.generateTicketPDF(
        request,
        event,
        organizer,
        qrCodeImage,
        currency,
      );
    } catch (pdfErr) {
      this.logger.warn(
        `Ticket PDF generation failed for scheduled-space request ${request._id}: ${
          (pdfErr as any)?.message || pdfErr
        }. Sending a plain confirmation email instead.`,
      );
    }

    await this.mailService.sendEmail({
      to: request.email,
      subject: isReissue
        ? `Your ticket, resent — ${event?.title || "Event"}`
        : `Your booking is confirmed — ${event?.title || "Event"}`,
      html,
      senderConfig: (organizer as any)?.emailConfig,
      attachments: [
        ...(pdfBuffer
          ? [{ filename: "scheduled-space-ticket.pdf", content: pdfBuffer }]
          : []),
        { filename: "qr-code.png", content: qrBase64, encoding: "base64", cid: qrCid },
      ],
    });
  }

  // Renders a single-page PDF ticket (event, registrant, booked slots, QR)
  // via headless Chromium — same puppeteer approach as the Stalls ticket.
  private async generateTicketPDF(
    request: ScheduledSpaceRequestDocument,
    event: any,
    organizer: any,
    qrCodeImage: string,
    currency: string,
  ): Promise<Buffer> {
    const rows = (request.selectedSlots || [])
      .map(
        (s: any) => `
        <tr>
          <td style="padding:8px 14px;color:#334155">${s.spaceName}${
            s.facilityType ? ` (${s.facilityType})` : ""
          }</td>
          <td style="padding:8px 14px;color:#334155">${s.date} ${s.startTime}-${s.endTime}</td>
          <td style="padding:8px 14px;font-weight:600;text-align:right">${currency}${s.price}</td>
        </tr>`,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin:0; padding:40px; background:#f8fafc; }
          .ticket { max-width:480px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0; }
          .header { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:#fff; padding:24px; text-align:center; }
          .header h1 { margin:0; font-size:20px; }
          .header p { margin:6px 0 0; opacity:0.9; font-size:13px; }
          .body { padding:24px; }
          table { border-collapse:collapse; width:100%; margin:12px 0; }
          th { background:#f8fafc; text-align:left; padding:8px 14px; font-size:12px; color:#64748b; }
          .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:14px; }
          .total { font-weight:700; }
          .qr { text-align:center; margin:24px 0; }
          .qr img { width:180px; height:180px; border:1px solid #e2e8f0; border-radius:8px; padding:8px; }
          .footer { text-align:center; padding:16px; color:#94a3b8; font-size:11px; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h1>${organizer?.organizationName || "EventSH"}</h1>
            <p>${event?.title || "Event"} — Scheduled Space Ticket</p>
          </div>
          <div class="body">
            <div class="row"><span>Registrant</span><strong>${request.name}</strong></div>
            <div class="row"><span>Email</span><strong>${request.email}</strong></div>
            ${
              request.whatsappNumber
                ? `<div class="row"><span>WhatsApp</span><strong>${request.whatsappNumber}</strong></div>`
                : ""
            }
            ${
              request.referralCode
                ? `<div class="row"><span>Referral Code</span><strong>${request.referralCode}</strong></div>`
                : ""
            }
            <table>
              <thead><tr><th>Space</th><th>Time Slot</th><th style="text-align:right">Price</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="row total"><span>Total Paid</span><span>${currency}${request.paidAmount || request.slotsTotal || 0}</span></div>
            <div class="qr"><img src="${qrCodeImage}" alt="Check-in QR" /></div>
            <p style="text-align:center;font-size:12px;color:#64748b">Show this QR at check-in.</p>
          </div>
          <div class="footer">
            <div>— ${organizer?.organizationName || "EventSH"}</div>
            <div style="margin-top:4px;opacity:0.7">Powered by EventSH</div>
          </div>
        </div>
      </body>
      </html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
      const uint8 = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", bottom: "10mm", left: "0mm", right: "0mm" },
      });
      return Buffer.from(uint8);
    } finally {
      await browser.close();
    }
  }

  // Visitor-facing direct download — regenerates the PDF on demand rather
  // than caching one on disk (the render is cheap and fully deterministic
  // from data already in the request/event/organizer docs, so there's
  // nothing to gain from persisting a file here the way Stalls does).
  async downloadTicket(id: string): Promise<{ buffer: Buffer; filename: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");
    if (request.status !== ScheduledSpaceStatusEnum.Completed || !request.qrCodeImage) {
      throw new BadRequestException(
        "This ticket is only available after payment is confirmed.",
      );
    }

    const [event, organizer] = await Promise.all([
      this.eventModel.findById(request.eventId).select("title"),
      this.organizerModel
        .findById(request.organizerId)
        .select("organizationName country"),
    ]);
    const currency = organizer?.country === "SG" ? "SG$" : "₹";

    const buffer = await this.generateTicketPDF(
      request,
      event,
      organizer,
      request.qrCodeImage,
      currency,
    );
    return { buffer, filename: `scheduled_space_ticket_${id}.pdf` };
  }

  // Organizer-triggered resend — re-renders the PDF and re-sends the same
  // email, without touching status (the booking is already Completed).
  async resendTicket(id: string, changedBy?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");
    if (
      request.status !== ScheduledSpaceStatusEnum.Completed ||
      !request.qrCodeImage
    ) {
      throw new BadRequestException(
        "This booking doesn't have a ticket to resend yet.",
      );
    }

    await this.emailTicket(request, request.qrCodeImage, { reissue: true });

    request.statusHistory.push({
      status: request.status as any,
      note: "Ticket resent to the registrant",
      changedBy: changedBy || "Organizer",
      changedAt: new Date(),
    } as any);
    await request.save();

    return { success: true, data: request };
  }

  // Organizer approve/reject (Pending -> Confirmed/Rejected), or cancel a
  // completed booking. Rejecting/cancelling frees any slots it had reserved.
  async updateStatus(id: string, dto: UpdateScheduledSpaceStatusDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");

    const releasingStatuses = ["Rejected", "Cancelled"];
    if (
      releasingStatuses.includes(dto.status) &&
      request.selectedSlots?.length
    ) {
      const tokens = request.selectedSlots.map(
        (s) => `${s.positionId}:${s.slotId}`,
      );
      await this.eventModel.updateOne(
        { _id: request.eventId },
        { $pull: { scheduledSpaceBookedSlots: { $in: tokens } } },
      );
    }

    request.status = dto.status;
    if (dto.cancellationReason) request.cancellationReason = dto.cancellationReason;
    if (dto.notes) request.notes = dto.notes;
    request.statusHistory.push({
      status: dto.status as ScheduledSpaceStatusEnum,
      note: dto.notes || dto.cancellationReason,
      changedBy: dto.changedBy,
      changedAt: new Date(),
    } as any);
    await request.save();

    return { success: true, data: request };
  }

  // Free-standing timeline note — doesn't change status, just records who
  // said what and when. Mirrors stalls.service.ts's addNote.
  async addNote(id: string, note: string, addedBy?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const trimmed = (note || "").trim();
    if (!trimmed) {
      throw new BadRequestException("Note text is required");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");

    request.statusHistory.push({
      status: request.status as any,
      note: trimmed,
      changedAt: new Date(),
      changedBy: (addedBy || "").trim() || "Unknown user",
    } as any);
    await request.save();

    return { success: true, data: request };
  }

  // Attaches/replaces the visitor's payment proof (transaction id and/or a
  // screenshot). Doesn't touch status — confirmPayment is the only thing
  // that moves the request to Completed.
  async updateTransactionDetails(
    id: string,
    transactionId?: string,
    transactionScreenshot?: string,
    paymentMethod?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const update: any = {};
    if (transactionId) update.transactionId = transactionId;
    if (transactionScreenshot) update.transactionScreenshot = transactionScreenshot;
    if (paymentMethod) update.paymentMethod = paymentMethod;

    const request = await this.requestModel.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!request) throw new NotFoundException("Request not found");
    return { success: true, data: request };
  }

  async scanQR(qrCodeData: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(qrCodeData);
    } catch {
      throw new BadRequestException("Invalid QR code");
    }
    if (parsed.type !== "eventsh-scheduled-space-checkin") {
      throw new BadRequestException("Invalid QR code type");
    }
    const request = await this.requestModel.findById(parsed.requestId);
    if (!request) throw new NotFoundException("Request not found");
    if (request.status === ScheduledSpaceStatusEnum.Cancelled) {
      throw new BadRequestException(
        "This booking was cancelled — the QR is no longer valid.",
      );
    }
    if (request.qrCodeData !== qrCodeData) {
      throw new BadRequestException(
        "This QR code has been superseded by an updated ticket.",
      );
    }
    if (request.hasCheckedIn) {
      throw new BadRequestException("Already checked in.");
    }
    request.hasCheckedIn = true;
    request.checkInTime = new Date();
    await request.save();
    return {
      success: true,
      message: "Check-in successful",
      data: {
        requestId: request._id,
        name: request.name,
        checkInTime: request.checkInTime,
        selectedSlots: request.selectedSlots,
      },
    };
  }

  async getAttendance(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");
    return {
      success: true,
      data: {
        hasCheckedIn: request.hasCheckedIn,
        checkInTime: request.checkInTime,
      },
    };
  }

  async findByEventId(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event id");
    }
    const requests = await this.requestModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .sort({ createdAt: -1 });
    return { success: true, data: requests };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");
    return { success: true, data: request };
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid request id");
    }
    const request = await this.requestModel.findById(id);
    if (!request) throw new NotFoundException("Request not found");
    if (request.selectedSlots?.length) {
      const tokens = request.selectedSlots.map(
        (s) => `${s.positionId}:${s.slotId}`,
      );
      await this.eventModel.updateOne(
        { _id: request.eventId },
        { $pull: { scheduledSpaceBookedSlots: { $in: tokens } } },
      );
    }
    await this.requestModel.deleteOne({ _id: id });
    return { success: true };
  }
}
