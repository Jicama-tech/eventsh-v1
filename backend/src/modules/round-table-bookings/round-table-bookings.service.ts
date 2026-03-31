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
  RoundTableBooking,
  RoundTableBookingDocument,
  RoundTablePaymentStatus,
} from "./entities/round-table-booking.entity";
import { CreateRoundTableBookingDto } from "./dto/create-round-table-booking.dto";
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
export class RoundTableBookingsService {
  private readonly logger = new Logger(RoundTableBookingsService.name);

  constructor(
    @InjectModel(RoundTableBooking.name)
    private readonly bookingModel: Model<RoundTableBookingDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Create a round table booking (status: Pending, awaiting payment)
   */
  async createBooking(dto: CreateRoundTableBookingDto) {
    const event = await this.eventModel.findById(dto.eventId);
    if (!event) throw new NotFoundException("Event not found");

    // Find the positioned round table
    const roundTable = (event.venueRoundTables || []).find(
      (rt: any) => rt.positionId === dto.tablePositionId,
    );
    if (!roundTable) {
      throw new NotFoundException("Round table not found in this event");
    }

    // Check availability
    const bookedChairs: number[] = roundTable.bookedChairs || [];

    if (roundTable.sellingMode === "table") {
      // Whole table must not be booked at all
      if (roundTable.isFullyBooked || bookedChairs.length > 0) {
        throw new ConflictException("This table is already booked");
      }
      // Ensure all chairs are selected
      const allChairs = Array.from(
        { length: roundTable.numberOfChairs },
        (_, i) => i,
      );
      dto.selectedChairIndices = allChairs;
    } else {
      // Chair mode: check each selected chair
      const conflicting = dto.selectedChairIndices.filter((idx) =>
        bookedChairs.includes(idx),
      );
      if (conflicting.length > 0) {
        throw new ConflictException(
          `Chair(s) ${conflicting.map((c) => c + 1).join(", ")} already booked`,
        );
      }
      // Validate chair indices are within range
      const invalid = dto.selectedChairIndices.filter(
        (idx) => idx < 0 || idx >= roundTable.numberOfChairs,
      );
      if (invalid.length > 0) {
        throw new BadRequestException("Invalid chair index selected");
      }
    }

    // Calculate amount
    const amount =
      roundTable.sellingMode === "table"
        ? roundTable.tablePrice
        : roundTable.chairPrice * dto.selectedChairIndices.length;

    const booking = await this.bookingModel.create({
      eventId: new Types.ObjectId(dto.eventId),
      organizerId: new Types.ObjectId(dto.organizerId),
      tablePositionId: dto.tablePositionId,
      tableName: roundTable.name,
      tableCategory: roundTable.category || "Standard",
      sellingMode: roundTable.sellingMode,
      selectedChairIndices: dto.selectedChairIndices,
      isWholeTable: roundTable.sellingMode === "table",
      numberOfSeats: dto.selectedChairIndices.length,
      visitorName: dto.visitorName,
      visitorEmail: dto.visitorEmail,
      visitorPhone: dto.visitorPhone,
      seatGuests: dto.seatGuests || [],
      amount,
      paymentStatus: RoundTablePaymentStatus.Pending,
    });

    return {
      success: true,
      message: "Round table booking created. Please complete payment.",
      data: booking,
    };
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

    if (booking.paymentStatus !== RoundTablePaymentStatus.Pending) {
      throw new BadRequestException(
        `Cannot submit payment. Current status: ${booking.paymentStatus}`,
      );
    }

    booking.paymentStatus = RoundTablePaymentStatus.Submitted;
    await booking.save();

    // Notify organizer via WhatsApp if possible
    try {
      const eventDoc = await this.eventModel
        .findById(booking.eventId)
        .populate("organizer");
      const orgPhone =
        eventDoc?.organizer?.whatsAppNumber || eventDoc?.organizer?.phone;
      if (orgPhone) {
        await this.otpService.sendWhatsAppMessage(
          orgPhone,
          `*New Round Table Payment Submitted*\n\n` +
            `Visitor: *${booking.visitorName}*\n` +
            `Table: *${booking.tableName}* (${booking.tableCategory})\n` +
            `Seats: ${booking.numberOfSeats}\n` +
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
        "Payment submitted. The organizer will confirm and your ticket will be sent via WhatsApp.",
      data: booking,
    };
  }

  /**
   * Organizer confirms payment — marks chairs booked, generates QR + PDF, sends WhatsApp
   */
  async confirmPayment(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException("Invalid booking ID");
    }

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.paymentStatus === RoundTablePaymentStatus.Paid) {
      throw new BadRequestException("Payment already confirmed");
    }

    if (booking.paymentStatus !== RoundTablePaymentStatus.Submitted) {
      throw new BadRequestException(
        `Cannot confirm. Customer has not submitted payment yet. Status: ${booking.paymentStatus}`,
      );
    }

    // Check availability first, then mark as booked
    const eventDoc = await this.eventModel.findById(booking.eventId);
    if (!eventDoc) throw new NotFoundException("Event not found");

    const rtIndex = (eventDoc.venueRoundTables || []).findIndex(
      (rt: any) => rt.positionId === booking.tablePositionId,
    );
    if (rtIndex === -1) throw new NotFoundException("Round table not found");

    const currentBooked: number[] =
      eventDoc.venueRoundTables[rtIndex].bookedChairs || [];
    const conflicting = booking.selectedChairIndices.filter((c: number) =>
      currentBooked.includes(c),
    );

    if (conflicting.length > 0) {
      booking.paymentStatus = RoundTablePaymentStatus.Failed;
      await booking.save();
      throw new ConflictException(
        `Chair(s) ${conflicting.map((c: number) => c + 1).join(", ")} already booked.`,
      );
    }

    // Mark chairs as booked + set isFullyBooked in a single update
    const newBooked = [...new Set([...currentBooked, ...booking.selectedChairIndices])];
    const roundTable = eventDoc.venueRoundTables[rtIndex];
    const isNowFull = newBooked.length >= roundTable.numberOfChairs;

    await this.eventModel.updateOne(
      {
        _id: booking.eventId,
        "venueRoundTables.positionId": booking.tablePositionId,
      },
      {
        $set: {
          "venueRoundTables.$.bookedChairs": newBooked,
          ...(isNowFull && { "venueRoundTables.$.isFullyBooked": true }),
        },
      },
    );

    // Generate QR code
    const qrPayload = {
      warning: "Please use the Eventsh app to scan this QR code.",
      type: "eventsh-roundtable-checkin",
      bookingId: bookingId,
      eventId: booking.eventId.toString(),
      issuedAt: new Date().toISOString(),
    };

    const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 200,
      margin: 2,
    });

    // Generate PDF ticket
    const organizerDoc = await this.organizerModel.findById(booking.organizerId);
    const country = organizerDoc?.country || "IN";

    // Set booking fields (single save at the end)
    booking.paymentStatus = RoundTablePaymentStatus.Paid;
    booking.qrCodeData = JSON.stringify(qrPayload);
    booking.qrCodePath = qrCodeBase64;

    try {
      const pdfBuffer = await this.generateTicketPDF(
        booking,
        eventDoc,
        qrCodeBase64,
        country,
      );

      const pdfDir = path.join(process.cwd(), "uploads", "roundTableTickets");
      await fs.promises.mkdir(pdfDir, { recursive: true });

      const pdfFileName = `round_table_ticket_${bookingId}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      booking.qrCodePath = `/uploads/roundTableTickets/${pdfFileName}`;

      // Send TABLE QR to the booking person (master ticket)
      if (booking.visitorPhone) {
        try {
          const chairList =
            booking.sellingMode === "table"
              ? `Entire table (${booking.numberOfSeats} seats)`
              : `Chair(s): ${booking.selectedChairIndices.map((c: number) => c + 1).join(", ")}`;

          await this.otpService.sendWhatsAppMessage(
            booking.visitorPhone,
            `*Round Table Booking Confirmed!*\n\n` +
              `Event: *${eventDoc.title}*\n` +
              `Table: *${booking.tableName}* (${booking.tableCategory})\n` +
              `${chairList}\n` +
              `Amount: *${formatCurrency(booking.amount, country)}*\n\n` +
              `Your table ticket with QR code is attached. Individual seat QRs have been sent to each guest.`,
          );

          await this.otpService.sendMediaMessage(
            booking.visitorPhone,
            pdfPath,
            `Table Ticket - ${eventDoc.title}`,
          );
        } catch (err) {
          this.logger.warn("Failed to send table ticket to booker", err);
        }
      }

      // Send INDIVIDUAL seat QR to each guest
      const seatGuests = booking.seatGuests || [];
      for (const guest of seatGuests) {
        if (!guest.name || !guest.whatsApp) continue;

        try {
          const seatQrPayload = {
            warning: "Please use the Eventsh app to scan this QR code.",
            type: "eventsh-roundtable-checkin",
            bookingId: bookingId,
            seatChairIndex: guest.chairIndex,
            guestName: guest.name,
            eventId: booking.eventId.toString(),
            issuedAt: new Date().toISOString(),
          };

          const seatQrBase64 = await QRCode.toDataURL(
            JSON.stringify(seatQrPayload),
            { width: 200, margin: 2 },
          );

          const seatPdfBuffer = await this.generateSeatTicketPDF(
            booking,
            eventDoc,
            guest,
            seatQrBase64,
            country,
          );

          const seatPdfName = `seat_ticket_${bookingId}_chair${guest.chairIndex + 1}.pdf`;
          const seatPdfPath = path.join(pdfDir, seatPdfName);
          await fs.promises.writeFile(seatPdfPath, seatPdfBuffer);

          await this.otpService.sendWhatsAppMessage(
            guest.whatsApp,
            `*You're Invited!*\n\n` +
              `Hi *${escapeHtml(guest.name)}*, you have a reserved seat at:\n\n` +
              `Event: *${eventDoc.title}*\n` +
              `Table: *${booking.tableName}* (${booking.tableCategory})\n` +
              `Seat: *Chair ${guest.chairIndex + 1}*\n\n` +
              `Your personal QR ticket is attached. Please show it at the entrance.`,
          );

          await this.otpService.sendMediaMessage(
            guest.whatsApp,
            seatPdfPath,
            `Seat Ticket - Chair ${guest.chairIndex + 1} - ${eventDoc.title}`,
          );

          this.logger.log(`Sent seat QR to ${guest.name} (${guest.whatsApp})`);
        } catch (guestErr) {
          this.logger.warn(
            `Failed to send seat ticket to guest ${guest.name}`,
            guestErr,
          );
        }
      }
    } catch (pdfError) {
      this.logger.warn("PDF generation failed, booking still confirmed", pdfError);
    }

    await booking.save();

    this.logger.log(`Round table payment confirmed for booking ${bookingId}`);

    return {
      success: true,
      message: "Payment confirmed. Ticket generated.",
      data: booking,
    };
  }

  /**
   * Get all round tables with booked chair data for an event
   */
  async getAvailableRoundTables(eventId: string) {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new BadRequestException("Invalid event ID");
    }

    const event = await this.eventModel.findById(eventId);
    if (!event) throw new NotFoundException("Event not found");

    return {
      success: true,
      data: {
        roundTables: event.venueRoundTables || [],
        venueConfig: event.venueConfig || [],
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
      .populate("eventId")
      .populate("organizerId")
      .sort({ createdAt: -1 });

    return { success: true, data: bookings };
  }

  /**
   * Get single booking by ID
   */
  async getBookingById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid booking ID");
    }

    const booking = await this.bookingModel
      .findById(id)
      .populate("eventId")
      .populate("organizerId");

    if (!booking) throw new NotFoundException("Booking not found");

    return { success: true, data: booking };
  }

  /**
   * Scan QR for check-in / check-out
   */
  async scanQR(qrCodeData: string) {
    let payload: any;
    try {
      payload = JSON.parse(qrCodeData);
    } catch {
      throw new BadRequestException("Invalid QR code data");
    }

    if (payload.type !== "eventsh-roundtable-checkin") {
      throw new BadRequestException("Invalid QR code type");
    }

    const booking = await this.bookingModel
      .findById(payload.bookingId)
      .populate("eventId");

    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.paymentStatus !== RoundTablePaymentStatus.Paid) {
      throw new BadRequestException("Booking payment not confirmed");
    }

    // First scan = check-in
    if (!booking.hasCheckedIn && !booking.hasCheckedOut) {
      booking.checkInTime = new Date();
      booking.hasCheckedIn = true;
      await booking.save();

      if (booking.visitorPhone) {
        try {
          await this.otpService.sendWhatsAppMessage(
            booking.visitorPhone,
            `*Check-in Successful!*\nWelcome! You have been checked in for *${(booking.eventId as any).title}*.\nTable: ${booking.tableName} (${booking.tableCategory})`,
          );
        } catch {
          // Non-critical
        }
      }

      return {
        success: true,
        message: "Check-in successful",
        data: {
          action: "CHECK_IN",
          checkInTime: booking.checkInTime,
          visitorName: booking.visitorName,
          tableName: booking.tableName,
          tableCategory: booking.tableCategory,
          seats: booking.numberOfSeats,
        },
      };
    }

    // Second scan = check-out
    if (booking.hasCheckedIn && !booking.hasCheckedOut) {
      booking.checkOutTime = new Date();
      booking.hasCheckedOut = true;
      await booking.save();

      const durationMs =
        booking.checkOutTime.getTime() - booking.checkInTime.getTime();
      const durationMin = Math.round(durationMs / 60000);

      if (booking.visitorPhone) {
        try {
          await this.otpService.sendWhatsAppMessage(
            booking.visitorPhone,
            `*Check-out Successful!*\nThank you for attending *${(booking.eventId as any).title}*.\nDuration: ${durationMin} minutes.`,
          );
        } catch {
          // Non-critical
        }
      }

      return {
        success: true,
        message: "Check-out successful",
        data: {
          action: "CHECK_OUT",
          checkInTime: booking.checkInTime,
          checkOutTime: booking.checkOutTime,
          durationMinutes: durationMin,
          visitorName: booking.visitorName,
          tableName: booking.tableName,
        },
      };
    }

    throw new BadRequestException("Already checked out");
  }

  /**
   * Download ticket PDF
   */
  async downloadTicket(bookingId: string) {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException("Invalid booking ID");
    }

    const booking = await this.bookingModel
      .findById(bookingId)
      .populate("eventId")
      .populate("organizerId");

    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.paymentStatus !== RoundTablePaymentStatus.Paid) {
      throw new BadRequestException("Payment not confirmed yet");
    }

    // Check if PDF exists on disk
    const pdfPath = path.join(
      process.cwd(),
      "uploads",
      "roundTableTickets",
      `round_table_ticket_${bookingId}.pdf`,
    );

    try {
      const buffer = await fs.promises.readFile(pdfPath);
      return {
        buffer,
        filename: `round_table_ticket_${bookingId}.pdf`,
      };
    } catch {
      // File doesn't exist, regenerate below
    }

    // Regenerate PDF if missing
    const organizerDoc = await this.organizerModel.findById(booking.organizerId);
    const country = organizerDoc?.country || "IN";

    const qrCodeBase64 = booking.qrCodePath?.startsWith("data:")
      ? booking.qrCodePath
      : await QRCode.toDataURL(booking.qrCodeData || "{}", {
          width: 200,
          margin: 2,
        });

    const event = await this.eventModel.findById(booking.eventId);
    const pdfBuffer = await this.generateTicketPDF(
      booking,
      event,
      qrCodeBase64,
      country,
    );

    const pdfDir = path.join(process.cwd(), "uploads", "roundTableTickets");
    await fs.promises.mkdir(pdfDir, { recursive: true });
    await fs.promises.writeFile(pdfPath, pdfBuffer);

    return {
      buffer: pdfBuffer,
      filename: `round_table_ticket_${bookingId}.pdf`,
    };
  }

  /**
   * Generate HTML ticket
   */
  private generateTicketHTML(
    booking: RoundTableBooking,
    event: any,
    qrBase64: string,
    country: string,
  ): string {
    const eventDate = new Date(event.startDate).toLocaleDateString();
    const chairList =
      booking.sellingMode === "table"
        ? `Entire Table (${booking.numberOfSeats} seats)`
        : booking.selectedChairIndices.map((c) => `Chair ${c + 1}`).join(", ");

    const seatGuestsHtml = (booking.seatGuests && booking.seatGuests.length > 0)
      ? `<div class="details-section">
            <h3>Guest List</h3>
            ${booking.seatGuests.map((g: any) => `<div class="detail-row"><span class="label">Chair ${g.chairIndex + 1}</span><span class="value">${escapeHtml(g.name)}${g.email ? ` &middot; ${escapeHtml(g.email)}` : ""}</span></div>`).join("")}
          </div>`
      : "";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 10px 15px; background-color: #f5f5f5; font-size: 10px; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
          .header h1 { font-size: 22px; color: #7c3aed; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; margin-top: 0; }
          .event-title { font-size: 20px; margin: 15px 0; font-weight: bold; }
          .details-section { margin: 15px 0; }
          .details-section h3 { font-size: 12px; color: #666; margin-bottom: 6px; text-transform: uppercase; border-bottom: 2px solid #7c3aed; display: inline-block; }
          .detail-row { padding: 5px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; }
          .detail-row .label { color: #666; }
          .detail-row .value { font-weight: bold; }
          .category-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: bold; color: white; background-color: #7c3aed; }
          .total-row { padding: 8px 0; font-size: 14px; font-weight: bold; color: #7c3aed; border-top: 2px solid #7c3aed; margin-top: 8px; display: flex; justify-content: space-between; }
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
            <h1>EVENTSH ROUND TABLE CONFIRMATION</h1>
            <p>Booking Confirmation</p>
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
            <h3>Table Details</h3>
            <div class="detail-row"><span class="label">Table</span><span class="value">${escapeHtml(booking.tableName)}</span></div>
            <div class="detail-row"><span class="label">Category</span><span class="value"><span class="category-badge">${escapeHtml(booking.tableCategory)}</span></span></div>
            <div class="detail-row"><span class="label">Seats</span><span class="value">${chairList}</span></div>
            <div class="detail-row"><span class="label">Type</span><span class="value">${booking.sellingMode === "table" ? "Whole Table" : "Individual Chairs"}</span></div>
          </div>

          ${seatGuestsHtml}

          <div class="details-section">
            <div class="total-row">
              <span>Total Amount Paid</span>
              <span>${formatCurrency(booking.amount, country)}</span>
            </div>
          </div>

          <div class="qr-section">
            <img src="${qrBase64}" alt="QR Code" />
            <p>Scan at Event Entrance - Use Eventsh App Only</p>
          </div>

          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Eventsh. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate PDF from HTML using Puppeteer
   */
  private async generateTicketPDF(
    booking: RoundTableBooking,
    event: any,
    qrBase64: string,
    country: string,
  ): Promise<Buffer> {
    const html = this.generateTicketHTML(booking, event, qrBase64, country);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
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

  private generateSeatTicketHTML(
    booking: RoundTableBooking,
    event: any,
    guest: { chairIndex: number; name: string; whatsApp?: string; email?: string },
    qrBase64: string,
    country: string,
  ): string {
    const eventDate = new Date(event.startDate).toLocaleDateString();
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 10px 15px; background-color: #f5f5f5; font-size: 10px; }
      .container { max-width: 500px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .header { text-align: center; margin-bottom: 15px; }
      .header h1 { font-size: 18px; color: #7c3aed; margin: 0; }
      .header p { font-size: 11px; color: #666; margin: 4px 0 0; }
      .event-title { font-size: 16px; font-weight: bold; text-align: center; margin: 10px 0; }
      .seat-badge { text-align: center; margin: 15px 0; }
      .seat-badge .number { display: inline-block; width: 50px; height: 50px; line-height: 50px; border-radius: 50%; background: #7c3aed; color: white; font-size: 22px; font-weight: bold; }
      .seat-badge .label { font-size: 11px; color: #666; margin-top: 4px; }
      .info { margin: 12px 0; }
      .info .row { padding: 5px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; }
      .info .row .k { color: #666; }
      .info .row .v { font-weight: bold; }
      .qr { text-align: center; margin: 15px 0; }
      .qr img { width: 140px; height: 140px; }
      .qr p { font-size: 8px; color: #999; margin-top: 3px; }
      .footer { text-align: center; font-size: 7px; color: #bbb; margin-top: 12px; border-top: 1px solid #eee; padding-top: 8px; }
    </style></head><body>
    <div class="container">
      <div class="header">
        <h1>SEAT TICKET</h1>
        <p>${escapeHtml(event.title)}</p>
      </div>
      <div class="seat-badge">
        <div class="number">${guest.chairIndex + 1}</div>
        <div class="label">Chair ${guest.chairIndex + 1} &middot; ${escapeHtml(booking.tableName)}</div>
      </div>
      <div class="info">
        <div class="row"><span class="k">Guest Name</span><span class="v">${escapeHtml(guest.name)}</span></div>
        <div class="row"><span class="k">Table</span><span class="v">${escapeHtml(booking.tableName)} (${escapeHtml(booking.tableCategory)})</span></div>
        <div class="row"><span class="k">Date</span><span class="v">${eventDate}</span></div>
        <div class="row"><span class="k">Location</span><span class="v">${escapeHtml(event.location || "TBA")}</span></div>
        <div class="row"><span class="k">Booked By</span><span class="v">${escapeHtml(booking.visitorName)}</span></div>
      </div>
      <div class="qr">
        <img src="${qrBase64}" alt="QR Code" />
        <p>Show this QR at the event entrance</p>
      </div>
      <div class="footer">&copy; ${new Date().getFullYear()} Eventsh. All rights reserved.</div>
    </div>
    </body></html>`;
  }

  private async generateSeatTicketPDF(
    booking: RoundTableBooking,
    event: any,
    guest: { chairIndex: number; name: string; whatsApp?: string; email?: string },
    qrBase64: string,
    country: string,
  ): Promise<Buffer> {
    const html = this.generateSeatTicketHTML(booking, event, guest, qrBase64, country);
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: "A5",
        printBackground: true,
        margin: { top: "8mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
