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
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as puppeteer from "puppeteer";
import {
  WorkshopBooking,
  WorkshopBookingDocument,
  WorkshopPaymentStatus,
} from "./entities/workshop-booking.entity";
import { CreateWorkshopBookingDto } from "./dto/create-workshop-booking.dto";
import { OtpService } from "../otp/otp.service";

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(amount: number, country?: string): string {
  if (country === "IN") {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  } else if (country === "SG") {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

@Injectable()
export class WorkshopBookingsService {
  private readonly logger = new Logger(WorkshopBookingsService.name);

  constructor(
    @InjectModel(WorkshopBooking.name)
    private readonly bookingModel: Model<WorkshopBookingDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Ticket") private readonly ticketModel: Model<any>,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Create a workshop booking (status: Pending, awaiting payment). Price and
   * item identity are always resolved server-side from the event document —
   * never trust a client-submitted amount.
   */
  async createBooking(dto: CreateWorkshopBookingDto) {
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new NotFoundException("Event not found");
    if (eventHasEnded(event)) {
      throw new BadRequestException(EVENT_ENDED_MESSAGE);
    }

    const sessions: any[] = event.workshopSessions || [];
    const packages: any[] = event.workshopPackages || [];

    let itemName: string;
    let unitPrice: number;
    let sessionIds: string[];

    if (dto.bookingType === "session") {
      const session = sessions.find((s: any) => s.id === dto.sessionId);
      if (!session) {
        throw new NotFoundException("Workshop not found in this event");
      }
      this.assertCapacity(session, dto.quantity, sessions);
      itemName = session.name;
      unitPrice = session.price || 0;
      sessionIds = [session.id];
    } else {
      const pkg = packages.find((p: any) => p.id === dto.packageId);
      if (!pkg) {
        throw new NotFoundException("Workshop package not found in this event");
      }
      if (!Array.isArray(pkg.sessionIds) || pkg.sessionIds.length < 2) {
        throw new BadRequestException("This package has no bundled workshops");
      }
      // A package booking needs a free seat in EVERY bundled session.
      for (const sid of pkg.sessionIds) {
        const session = sessions.find((s: any) => s.id === sid);
        if (!session) {
          throw new NotFoundException(
            "One of this package's workshops no longer exists",
          );
        }
        this.assertCapacity(session, dto.quantity, sessions, pkg.name);
      }
      itemName = pkg.name;
      unitPrice = pkg.price || 0;
      sessionIds = [...pkg.sessionIds];
    }

    const amount = unitPrice * dto.quantity;

    const booking = await this.bookingModel.create({
      eventId: new Types.ObjectId(dto.eventId),
      organizerId: new Types.ObjectId(dto.organizerId),
      bookingType: dto.bookingType,
      sessionId: dto.bookingType === "session" ? dto.sessionId : undefined,
      packageId: dto.bookingType === "package" ? dto.packageId : undefined,
      sessionIds,
      itemName,
      quantity: dto.quantity,
      visitorName: dto.visitorName,
      visitorEmail: dto.visitorEmail,
      visitorPhone: dto.visitorPhone,
      amount,
      paymentStatus: WorkshopPaymentStatus.Pending,
    });

    return {
      success: true,
      message: "Workshop booking created. Please complete payment.",
      data: booking,
    };
  }

  // Capacity check against the CONFIRMED (bookedSeats) count only — mirrors
  // round tables: a Pending/Submitted booking does not yet hold a seat, and
  // an oversold race is caught again (and failed) at confirmPayment time.
  private assertCapacity(
    session: any,
    quantity: number,
    allSessions: any[],
    packageName?: string,
  ) {
    const maxSeats = session.maxSeats || 0;
    if (maxSeats <= 0) return; // 0 / unset = unlimited
    const remaining = maxSeats - (session.bookedSeats || 0);
    if (remaining < quantity) {
      const label = packageName ? `"${session.name}" (in ${packageName})` : `"${session.name}"`;
      throw new ConflictException(
        `Not enough seats left for ${label}. ${Math.max(remaining, 0)} remaining.`,
      );
    }
  }

  /**
   * Customer marks payment as submitted (awaiting organizer confirmation)
   */
  async submitPayment(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException("Invalid booking ID");
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException("Booking not found");

    const bookingEvent = await this.eventModel.findById(booking.eventId);
    if (eventHasEnded(bookingEvent as any)) {
      throw new BadRequestException(EVENT_ENDED_MESSAGE);
    }

    if (booking.paymentStatus !== WorkshopPaymentStatus.Pending) {
      throw new BadRequestException(
        `Cannot submit payment. Current status: ${booking.paymentStatus}`,
      );
    }

    booking.paymentStatus = WorkshopPaymentStatus.Submitted;
    await booking.save();

    try {
      const eventDoc = await this.eventModel
        .findById(booking.eventId)
        .populate("organizer");
      const orgPhone =
        eventDoc?.organizer?.whatsAppNumber || eventDoc?.organizer?.phone;
      if (orgPhone) {
        await this.otpService.sendWhatsAppMessage(
          orgPhone,
          `*New Workshop Payment Submitted*\n\n` +
            `Visitor: *${booking.visitorName}*\n` +
            `Workshop: *${booking.itemName}*\n` +
            `Quantity: ${booking.quantity}\n` +
            `Amount: ${booking.amount}\n\n` +
            `Please confirm this payment from your organizer dashboard.`,
        );
      }
    } catch {
      this.logger.warn("Failed to notify organizer about submitted payment");
    }

    return {
      success: true,
      message:
        "Payment submitted. The organizer will confirm and your ticket will be sent.",
      data: booking,
    };
  }

  /**
   * Organizer confirms payment — marks seats booked, generates QR + PDF, sends ticket
   */
  async confirmPayment(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException("Invalid booking ID");
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.paymentStatus === WorkshopPaymentStatus.Paid) {
      throw new BadRequestException("Payment already confirmed");
    }
    if (booking.paymentStatus !== WorkshopPaymentStatus.Submitted) {
      throw new BadRequestException(
        `Cannot confirm. Customer has not submitted payment yet. Status: ${booking.paymentStatus}`,
      );
    }

    const eventDoc = await this.eventModel.findById(booking.eventId);
    if (!eventDoc) throw new NotFoundException("Event not found");

    const sessions: any[] = eventDoc.workshopSessions || [];
    const conflicts: string[] = [];
    for (const sid of booking.sessionIds) {
      const session = sessions.find((s: any) => s.id === sid);
      if (!session) continue;
      const maxSeats = session.maxSeats || 0;
      if (maxSeats > 0) {
        const remaining = maxSeats - (session.bookedSeats || 0);
        if (remaining < booking.quantity) conflicts.push(session.name);
      }
    }

    if (conflicts.length > 0) {
      booking.paymentStatus = WorkshopPaymentStatus.Failed;
      await booking.save();
      throw new ConflictException(
        `Not enough seats remaining for: ${conflicts.join(", ")}.`,
      );
    }

    // Re-fetch as a document so we can mutate the embedded array and save —
    // a package spans multiple sessions, so a single positional ($) update
    // can't touch all of them in one query.
    for (const sid of booking.sessionIds) {
      const session = sessions.find((s: any) => s.id === sid);
      if (session) session.bookedSeats = (session.bookedSeats || 0) + booking.quantity;
    }
    eventDoc.workshopSessions = sessions;
    eventDoc.markModified("workshopSessions");
    await eventDoc.save();

    // Generate QR code
    const qrPayload = {
      warning: "Please use the Eventsh app to scan this QR code.",
      type: "eventsh-workshop-checkin",
      bookingId: bookingId,
      eventId: booking.eventId.toString(),
      issuedAt: new Date().toISOString(),
    };

    const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 200,
      margin: 2,
    });

    const organizerDoc = await this.organizerModel.findById(booking.organizerId);
    const country = organizerDoc?.country || "IN";

    booking.paymentStatus = WorkshopPaymentStatus.Paid;
    booking.qrCodeData = JSON.stringify(qrPayload);
    booking.qrCodePath = qrCodeBase64;

    try {
      // A package booking gets ONE PDF with one ticket page per bundled
      // workshop (all sharing this booking's QR — check-in is per-booking,
      // not per-session) so the visitor still gets a single email/attachment
      // covering every workshop in the combo.
      const sessionNames =
        booking.bookingType === "package"
          ? booking.sessionIds.map(
              (sid) =>
                sessions.find((s: any) => s.id === sid)?.name || "Workshop",
            )
          : [booking.itemName];

      const pdfBuffer =
        booking.bookingType === "package"
          ? await this.generatePackageTicketPDF(
              booking,
              eventDoc,
              sessionNames,
              qrCodeBase64,
              country,
            )
          : await this.generateTicketPDF(booking, eventDoc, qrCodeBase64, country);

      const pdfDir = path.join(process.cwd(), "uploads", "workshopTickets");
      await fs.promises.mkdir(pdfDir, { recursive: true });

      const pdfFileName = `workshop_ticket_${bookingId}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      booking.qrCodePath = `/uploads/workshopTickets/${pdfFileName}`;

      const itemsLine =
        booking.bookingType === "package"
          ? `Includes: ${sessionNames.join(", ")}\n`
          : "";

      if (booking.visitorPhone || booking.visitorEmail) {
        try {
          await this.otpService.sendWhatsAppMessage(
            booking.visitorPhone,
            `*Workshop Booking Confirmed!*\n\n` +
              `Event: *${eventDoc.title}*\n` +
              `Workshop: *${booking.itemName}*\n` +
              itemsLine +
              `Quantity: ${booking.quantity}\n` +
              `Amount: *${formatCurrency(booking.amount, country)}*\n\n` +
              `Your ticket${booking.bookingType === "package" ? "s are" : " is"} attached.`,
          );

          await this.otpService.sendMediaMessage(
            booking.visitorPhone,
            pdfPath,
            `Workshop Ticket - ${eventDoc.title}`,
            "workshop-ticket.pdf",
            {
              to: booking.visitorEmail,
              subject: `Workshop booking confirmed — ${eventDoc.title}`,
              heading: "Workshop Booking Confirmed!",
              message:
                `Event: ${eventDoc.title}\n` +
                `Workshop: ${booking.itemName}\n` +
                itemsLine +
                `Quantity: ${booking.quantity}\n` +
                `Amount: ${formatCurrency(booking.amount, country)}\n\n` +
                `Your ticket${booking.bookingType === "package" ? "s are" : " is"} attached.`,
              senderConfig: (organizerDoc as any)?.emailConfig,
            },
          );
        } catch (err) {
          this.logger.warn("Failed to send workshop ticket to visitor", err);
        }
      }
    } catch (pdfError) {
      this.logger.warn("PDF generation failed, booking still confirmed", pdfError);
    }

    await booking.save();

    // Mirror this booking into the Tickets collection — purely so the buyer
    // shows up alongside every other visitor in the organizer's Visitors tab
    // and cross-event CRM (both already query Tickets). Best-effort: this
    // read-model write must never fail a confirmed workshop payment.
    try {
      await this.ticketModel.create({
        ticketId: `WS-${booking._id}`,
        eventId: booking.eventId,
        organizerId: booking.organizerId,
        eventTitle: eventDoc.title,
        eventDate: eventDoc.startDate,
        eventTime: eventDoc.time || "",
        eventVenue: eventDoc.location || eventDoc.address || "TBA",
        customerName: booking.visitorName,
        customerEmail: booking.visitorEmail,
        customerWhatsapp: booking.visitorPhone,
        ticketDetails: [
          {
            ticketType: `Workshop: ${booking.itemName}`,
            quantity: booking.quantity,
            price: booking.amount,
          },
        ],
        totalAmount: booking.amount,
        paymentConfirmed: true,
        status: "confirmed",
        purchaseDate: new Date(),
        qrCode: booking.qrCodeData,
        pdfPath: booking.qrCodePath,
      });
    } catch (mirrorErr) {
      this.logger.warn(
        "Failed to mirror workshop booking into Tickets (Visitors/CRM listing)",
        mirrorErr,
      );
    }

    this.logger.log(`Workshop payment confirmed for booking ${bookingId}`);

    return {
      success: true,
      message: "Payment confirmed. Ticket generated.",
      data: booking,
    };
  }

  /**
   * Get all workshop sessions + packages with live seat counts for an event
   */
  async getAvailableWorkshops(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event ID");
    }

    const event = await this.eventModel.findById(eventId);
    if (!event) throw new NotFoundException("Event not found");

    return {
      success: true,
      data: {
        workshopSessions: event.workshopSessions || [],
        workshopPackages: event.workshopPackages || [],
      },
    };
  }

  /**
   * Get all bookings for an event (organizer dashboard)
   */
  async getBookingsByEvent(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event ID");
    }

    const bookings = await this.bookingModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .sort({ createdAt: -1 });

    return { success: true, data: bookings };
  }

  async getBookingById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid booking ID");
    }
    const booking = await this.bookingModel.findById(id);
    if (!booking) throw new NotFoundException("Booking not found");
    return { success: true, data: booking };
  }

  /**
   * Scan QR for check-in (single-stage — a workshop is attended once)
   */
  async scanQR(qrCodeData: string) {
    let payload: any;
    try {
      payload = JSON.parse(qrCodeData);
    } catch {
      throw new BadRequestException("Invalid QR code data");
    }

    if (payload.type !== "eventsh-workshop-checkin") {
      throw new BadRequestException("Invalid QR code type");
    }

    const booking = await this.bookingModel.findById(payload.bookingId);
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.paymentStatus !== WorkshopPaymentStatus.Paid) {
      throw new BadRequestException("Booking payment not confirmed");
    }

    if (booking.hasCheckedIn) {
      return {
        success: true,
        message: "Already checked in",
        data: {
          action: "ALREADY_CHECKED_IN",
          checkInTime: booking.checkInTime,
          visitorName: booking.visitorName,
          itemName: booking.itemName,
        },
      };
    }

    booking.checkInTime = new Date();
    booking.hasCheckedIn = true;
    await booking.save();

    return {
      success: true,
      message: "Check-in successful",
      data: {
        action: "CHECK_IN",
        checkInTime: booking.checkInTime,
        visitorName: booking.visitorName,
        itemName: booking.itemName,
        quantity: booking.quantity,
      },
    };
  }

  async downloadTicket(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException("Invalid booking ID");
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.paymentStatus !== WorkshopPaymentStatus.Paid) {
      throw new BadRequestException("Payment not confirmed yet");
    }

    const pdfPath = path.join(
      process.cwd(),
      "uploads",
      "workshopTickets",
      `workshop_ticket_${bookingId}.pdf`,
    );

    try {
      const buffer = await fs.promises.readFile(pdfPath);
      return { buffer, filename: `workshop_ticket_${bookingId}.pdf` };
    } catch {
      // regenerate below
    }

    const organizerDoc = await this.organizerModel.findById(booking.organizerId);
    const country = organizerDoc?.country || "IN";

    const qrCodeBase64 = booking.qrCodePath?.startsWith("data:")
      ? booking.qrCodePath
      : await QRCode.toDataURL(booking.qrCodeData || "{}", {
          width: 200,
          margin: 2,
        });

    const event = await this.eventModel.findById(booking.eventId);
    const sessions: any[] = event?.workshopSessions || [];
    const sessionNames =
      booking.bookingType === "package"
        ? booking.sessionIds.map(
            (sid) => sessions.find((s: any) => s.id === sid)?.name || "Workshop",
          )
        : [booking.itemName];
    const pdfBuffer =
      booking.bookingType === "package"
        ? await this.generatePackageTicketPDF(
            booking,
            event,
            sessionNames,
            qrCodeBase64,
            country,
          )
        : await this.generateTicketPDF(booking, event, qrCodeBase64, country);

    const pdfDir = path.join(process.cwd(), "uploads", "workshopTickets");
    await fs.promises.mkdir(pdfDir, { recursive: true });
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    return { buffer: pdfBuffer, filename: `workshop_ticket_${bookingId}.pdf` };
  }

  private generateTicketHTML(
    booking: WorkshopBooking,
    event: any,
    qrBase64: string,
    country: string,
    orgName?: string,
  ): string {
    const eventDate = new Date(event.startDate).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px 15px; background-color: #f5f5f5; font-size: 10px; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
          .header h1 { font-size: 22px; color: #0891b2; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; margin-top: 0; }
          .event-title { font-size: 20px; margin: 15px 0; font-weight: bold; }
          .details-section { margin: 15px 0; }
          .details-section h3 { font-size: 12px; color: #666; margin-bottom: 6px; text-transform: uppercase; border-bottom: 2px solid #0891b2; display: inline-block; }
          .detail-row { padding: 5px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; }
          .detail-row .label { color: #666; }
          .detail-row .value { font-weight: bold; }
          .total-row { padding: 8px 0; font-size: 14px; font-weight: bold; color: #0891b2; border-top: 2px solid #0891b2; margin-top: 8px; display: flex; justify-content: space-between; }
          .qr-section { text-align: center; margin: 15px 0; }
          .qr-section img { width: 160px; height: 160px; }
          .qr-section p { font-size: 9px; color: #999; margin-top: 4px; }
          .footer { text-align: center; font-size: 8px; color: #999; margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; }
          @media print { body { background: white; } .container { box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${escapeHtml(orgName || "EventSH")}</h1>
            <p>Workshop Booking Confirmation</p>
          </div>

          <div class="event-title">${escapeHtml(event.title)}</div>

          <div class="details-section">
            <h3>Event Details</h3>
            <div class="detail-row"><span class="label">Date</span><span class="value">${eventDate}</span></div>
            <div class="detail-row"><span class="label">Location</span><span class="value">${escapeHtml(event.location || "TBA")}</span></div>
          </div>

          <div class="details-section">
            <h3>Visitor Details</h3>
            <div class="detail-row"><span class="label">Name</span><span class="value">${escapeHtml(booking.visitorName)}</span></div>
            <div class="detail-row"><span class="label">Email</span><span class="value">${escapeHtml(booking.visitorEmail)}</span></div>
            <div class="detail-row"><span class="label">Phone</span><span class="value">${escapeHtml(booking.visitorPhone)}</span></div>
          </div>

          <div class="details-section">
            <h3>Workshop Details</h3>
            <div class="detail-row"><span class="label">Workshop</span><span class="value">${escapeHtml(booking.itemName)}</span></div>
            <div class="detail-row"><span class="label">Type</span><span class="value">${booking.bookingType === "package" ? "Package" : "Single Session"}</span></div>
            <div class="detail-row"><span class="label">Quantity</span><span class="value">${booking.quantity}</span></div>
          </div>

          <div class="details-section">
            <div class="total-row">
              <span>Total Amount Paid</span>
              <span>${formatCurrency(booking.amount, country)}</span>
            </div>
          </div>

          <div class="qr-section">
            <img src="${qrBase64}" alt="QR Code" />
            <p>Scan at Workshop Entrance - Use Eventsh App Only</p>
          </div>

          <div class="footer">
            <p>Powered by EventSH</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private async generateTicketPDF(
    booking: WorkshopBooking,
    event: any,
    qrBase64: string,
    country: string,
  ): Promise<Buffer> {
    const org = await this.organizerModel.findById(booking.organizerId);
    const orgName =
      (org as any)?.organizationName || (org as any)?.name || "EventSH";
    const html = this.generateTicketHTML(booking, event, qrBase64, country, orgName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  // One ticket page per bundled workshop, all sharing this booking's QR
  // (check-in is per-booking, not per-session) — joined with a hard page
  // break so each prints/displays as its own ticket inside one PDF.
  private generatePackageTicketHTML(
    booking: WorkshopBooking,
    event: any,
    sessionNames: string[],
    qrBase64: string,
    country: string,
    orgName?: string,
  ): string {
    const eventDate = new Date(event.startDate).toLocaleDateString();
    const pages = sessionNames
      .map(
        (name, idx) => `
        <div class="container" style="${idx > 0 ? "page-break-before: always;" : ""}">
          <div class="header">
            <h1>${escapeHtml(orgName || "EventSH")}</h1>
            <p>Workshop Package Booking Confirmation</p>
          </div>

          <div class="event-title">${escapeHtml(event.title)}</div>

          <div class="details-section">
            <h3>Event Details</h3>
            <div class="detail-row"><span class="label">Date</span><span class="value">${eventDate}</span></div>
            <div class="detail-row"><span class="label">Location</span><span class="value">${escapeHtml(event.location || "TBA")}</span></div>
          </div>

          <div class="details-section">
            <h3>Visitor Details</h3>
            <div class="detail-row"><span class="label">Name</span><span class="value">${escapeHtml(booking.visitorName)}</span></div>
            <div class="detail-row"><span class="label">Email</span><span class="value">${escapeHtml(booking.visitorEmail)}</span></div>
            <div class="detail-row"><span class="label">Phone</span><span class="value">${escapeHtml(booking.visitorPhone)}</span></div>
          </div>

          <div class="details-section">
            <h3>Workshop ${idx + 1} of ${sessionNames.length}</h3>
            <div class="detail-row"><span class="label">Workshop</span><span class="value">${escapeHtml(name)}</span></div>
            <div class="detail-row"><span class="label">Package</span><span class="value">${escapeHtml(booking.itemName)}</span></div>
            <div class="detail-row"><span class="label">Quantity</span><span class="value">${booking.quantity}</span></div>
          </div>

          ${
            idx === 0
              ? `<div class="details-section">
                  <div class="total-row">
                    <span>Total Amount Paid (Package)</span>
                    <span>${formatCurrency(booking.amount, country)}</span>
                  </div>
                </div>`
              : ""
          }

          <div class="qr-section">
            <img src="${qrBase64}" alt="QR Code" />
            <p>Scan at Workshop Entrance - Use Eventsh App Only</p>
          </div>

          <div class="footer">
            <p>Powered by EventSH</p>
          </div>
        </div>`,
      )
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px 15px; background-color: #f5f5f5; font-size: 10px; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
          .header h1 { font-size: 22px; color: #0891b2; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; margin-top: 0; }
          .event-title { font-size: 20px; margin: 15px 0; font-weight: bold; }
          .details-section { margin: 15px 0; }
          .details-section h3 { font-size: 12px; color: #666; margin-bottom: 6px; text-transform: uppercase; border-bottom: 2px solid #0891b2; display: inline-block; }
          .detail-row { padding: 5px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; }
          .detail-row .label { color: #666; }
          .detail-row .value { font-weight: bold; }
          .total-row { padding: 8px 0; font-size: 14px; font-weight: bold; color: #0891b2; border-top: 2px solid #0891b2; margin-top: 8px; display: flex; justify-content: space-between; }
          .qr-section { text-align: center; margin: 15px 0; }
          .qr-section img { width: 160px; height: 160px; }
          .qr-section p { font-size: 9px; color: #999; margin-top: 4px; }
          .footer { text-align: center; font-size: 8px; color: #999; margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; }
          @media print { body { background: white; } .container { box-shadow: none; } }
        </style>
      </head>
      <body>
        ${pages}
      </body>
      </html>
    `;
  }

  private async generatePackageTicketPDF(
    booking: WorkshopBooking,
    event: any,
    sessionNames: string[],
    qrBase64: string,
    country: string,
  ): Promise<Buffer> {
    const org = await this.organizerModel.findById(booking.organizerId);
    const orgName =
      (org as any)?.organizationName || (org as any)?.name || "EventSH";
    const html = this.generatePackageTicketHTML(
      booking,
      event,
      sessionNames,
      qrBase64,
      country,
      orgName,
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
