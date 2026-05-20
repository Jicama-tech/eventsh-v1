import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { OtpService } from "../otp/otp.service";
import { MailService } from "../roles/mail.service";
import * as fs from "fs";
import * as path from "path";
const PDFDocument = require("pdfkit");

export interface BillingRates {
  stallRate: number;
  roundTableRate: number;
  chairRate: number;
  speakerRate: number;
  currency: string;
}

const DEFAULT_RATES: BillingRates = {
  stallRate: 20,
  roundTableRate: 20,
  chairRate: 5,
  speakerRate: 20,
  currency: "USD",
};

@Injectable()
export class BillingPaymentsService {
  private readonly logger = new Logger(BillingPaymentsService.name);

  constructor(
    @InjectModel("PendingBillingPayment") private pendingModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("SpeakerRequest") private speakerRequestModel: Model<any>,
    @InjectModel("OrganizerPayment") private organizerPaymentModel: Model<any>,
    @InjectModel("PlatformBillingRates") private ratesModel: Model<any>,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  //  Per-event amount calc (mirrors admin.service.getOrganizerBilling so the
  //  numbers match exactly when admin opens OrganizerBillingDialog).
  // ---------------------------------------------------------------------------
  private flatten(v: any): any[] {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") return Object.values(v).flat() as any[];
    return [];
  }

  private async loadRates(): Promise<BillingRates> {
    const doc = (await this.ratesModel.findOne({}).lean()) as any;
    if (!doc) return { ...DEFAULT_RATES };
    return {
      stallRate: Number(doc.stallRate) || DEFAULT_RATES.stallRate,
      roundTableRate:
        Number(doc.roundTableRate) || DEFAULT_RATES.roundTableRate,
      chairRate: Number(doc.chairRate) || DEFAULT_RATES.chairRate,
      speakerRate: Number(doc.speakerRate) || DEFAULT_RATES.speakerRate,
      currency: doc.currency || DEFAULT_RATES.currency,
    };
  }

  private regionFromCountry(country?: string): {
    scheme: "UPI" | "PAYNOW";
    currency: string;
  } | null {
    const c = (country || "").trim().toLowerCase();
    if (c === "in" || c === "india")
      return { scheme: "UPI", currency: "INR" };
    if (c === "sg" || c === "singapore" || c === "sgp")
      return { scheme: "PAYNOW", currency: "SGD" };
    return null;
  }

  private computeEventCounts(event: any, speakers: number) {
    const tables = this.flatten(event.venueTables);
    const rounds = this.flatten(event.venueRoundTables);
    const stallsSold = tables.filter((t: any) => !!t?.isBooked).length;
    const tablesBooked = rounds.filter(
      (rt: any) =>
        !!rt?.isFullyBooked ||
        (Array.isArray(rt?.bookedChairs) && rt.bookedChairs.length > 0),
    ).length;
    const chairsBooked = rounds.reduce(
      (acc: number, rt: any) =>
        acc + (Array.isArray(rt?.bookedChairs) ? rt.bookedChairs.length : 0),
      0,
    );
    return { stallsSold, tablesBooked, chairsBooked, speakersBooked: speakers };
  }

  // ---------------------------------------------------------------------------
  //  GET /billing-payments/me  — organizer's own per-event breakdown
  // ---------------------------------------------------------------------------
  async getMyBilling(organizerId: string) {
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");

    const rates = await this.loadRates();
    const events = (await this.eventModel
      .find({ organizer: organizerId })
      .select("title startDate endDate venueTables venueRoundTables status")
      .lean()) as any[];

    // Speaker counts grouped by event (Confirmed only).
    const speakerAgg = await this.speakerRequestModel
      .aggregate([
        {
          $match: {
            organizerId: new Types.ObjectId(organizerId),
            status: "Confirmed",
          },
        },
        { $group: { _id: "$eventId", n: { $sum: 1 } } },
      ])
      .exec();
    const speakersByEvent = new Map<string, number>(
      speakerAgg.map((r: any) => [String(r._id), r.n]),
    );

    // Per-event payment-state lookup. We pick the most-recent non-rejected
    // row per eventId — that's the active claim driving the row's UI status.
    const claimRows = (await this.pendingModel
      .find({
        organizerId,
        status: { $in: ["awaiting_payment", "submitted", "confirmed"] },
      })
      .sort({ createdAt: -1 })
      .lean()) as any[];
    const activeClaimByEvent = new Map<string, any>();
    for (const r of claimRows) {
      const k = String(r.eventId);
      if (!activeClaimByEvent.has(k)) activeClaimByEvent.set(k, r);
    }

    const rows = events.map((e: any) => {
      const counts = this.computeEventCounts(
        e,
        speakersByEvent.get(String(e._id)) || 0,
      );
      const amount =
        counts.stallsSold * rates.stallRate +
        counts.tablesBooked * rates.roundTableRate +
        counts.chairsBooked * rates.chairRate +
        counts.speakersBooked * rates.speakerRate;
      const claim = activeClaimByEvent.get(String(e._id));
      return {
        eventId: String(e._id),
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        ...counts,
        amount,
        claim: claim
          ? {
              _id: String(claim._id),
              status: claim.status,
              amount: claim.amount,
              currency: claim.currency,
              ref: claim.ref,
              submittedAt: claim.submittedAt || null,
              confirmedAt: claim.confirmedAt || null,
            }
          : null,
      };
    });

    const region = this.regionFromCountry(organizer.country);
    return {
      organizer: {
        _id: String(organizer._id),
        name: organizer.name,
        organizationName: organizer.organizationName,
        country: organizer.country,
      },
      rates,
      events: rows,
      region: region
        ? { scheme: region.scheme, currency: region.currency }
        : null,
    };
  }

  // ---------------------------------------------------------------------------
  //  POST /billing-payments/initiate  — start a per-event payment claim
  // ---------------------------------------------------------------------------
  async initiate(organizerId: string, body: { eventId: string }) {
    if (!body?.eventId) throw new BadRequestException("eventId required");
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");
    const event = (await this.eventModel.findById(body.eventId).lean()) as any;
    if (!event) throw new NotFoundException("Event not found");
    if (String(event.organizer) !== String(organizerId)) {
      throw new BadRequestException("Not your event");
    }

    const region = this.regionFromCountry(organizer.country);
    if (!region) {
      throw new BadRequestException(
        "Your country has no QR payment scheme configured. Contact admin to settle off-band.",
      );
    }

    const rates = await this.loadRates();
    const speakerCount = await this.speakerRequestModel.countDocuments({
      organizerId,
      eventId: body.eventId,
      status: "Confirmed",
    });
    const counts = this.computeEventCounts(event, speakerCount);
    const amount =
      counts.stallsSold * rates.stallRate +
      counts.tablesBooked * rates.roundTableRate +
      counts.chairsBooked * rates.chairRate +
      counts.speakersBooked * rates.speakerRate;
    if (amount <= 0) {
      throw new BadRequestException(
        "Nothing to pay for this event yet.",
      );
    }

    // Idempotency: an in-flight or already-confirmed claim for this
    // (organizer, event) is returned as-is. Rejected ones are ignored so
    // the organizer can retry.
    const existing = (await this.pendingModel
      .findOne({
        organizerId,
        eventId: body.eventId,
        status: { $in: ["awaiting_payment", "submitted", "confirmed"] },
      })
      .sort({ createdAt: -1 })
      .lean()) as any;
    if (existing) {
      if (existing.status === "confirmed") {
        throw new ConflictException(
          "This event has already been paid for.",
        );
      }
      return this.toClient(existing, event);
    }

    const ref = `EVT-${String(organizerId).slice(-4)}-${String(
      body.eventId,
    ).slice(-4)}-${Date.now().toString(36).toUpperCase()}`;
    const doc = await this.pendingModel.create({
      organizerId,
      eventId: body.eventId,
      amount,
      currency: region.currency,
      scheme: region.scheme,
      ref,
      status: "awaiting_payment",
      ...counts,
    });
    return this.toClient(doc.toObject(), event);
  }

  async markSubmitted(organizerId: string, id: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Payment request not found");
    if (String(doc.organizerId) !== String(organizerId)) {
      throw new BadRequestException("Not your payment request");
    }
    if (doc.status === "confirmed" || doc.status === "rejected") {
      throw new ConflictException(
        `Already ${doc.status}; cannot mark as paid again`,
      );
    }
    doc.status = "submitted";
    doc.submittedAt = new Date();
    await doc.save();
    return { ok: true, status: doc.status };
  }

  // ---------------------------------------------------------------------------
  //  Admin-facing
  // ---------------------------------------------------------------------------
  async listPending() {
    const rows = (await this.pendingModel
      .find({ status: { $in: ["awaiting_payment", "submitted"] } })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean()) as any[];
    if (rows.length === 0) return [];
    const orgIds = Array.from(
      new Set(rows.map((r: any) => String(r.organizerId))),
    );
    const evIds = Array.from(new Set(rows.map((r: any) => String(r.eventId))));
    const [orgs, events] = await Promise.all([
      this.organizerModel
        .find({ _id: { $in: orgIds } })
        .select("name organizationName email whatsAppNumber country")
        .lean(),
      this.eventModel
        .find({ _id: { $in: evIds } })
        .select("title startDate endDate")
        .lean(),
    ]);
    const orgMap = new Map<string, any>(
      (orgs as any[]).map((o: any) => [String(o._id), o]),
    );
    const evMap = new Map<string, any>(
      (events as any[]).map((e: any) => [String(e._id), e]),
    );
    return rows.map((r: any) => ({
      _id: String(r._id),
      organizer: orgMap.get(String(r.organizerId)) || null,
      event: evMap.get(String(r.eventId)) || null,
      amount: r.amount,
      currency: r.currency,
      scheme: r.scheme,
      status: r.status,
      ref: r.ref,
      stallsSold: r.stallsSold,
      tablesBooked: r.tablesBooked,
      chairsBooked: r.chairsBooked,
      speakersBooked: r.speakersBooked,
      submittedAt: r.submittedAt || null,
      createdAt: r.createdAt,
    }));
  }

  async confirm(id: string, adminId?: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Payment request not found");
    if (doc.status === "confirmed")
      throw new ConflictException("Already confirmed");
    if (doc.status === "rejected")
      throw new ConflictException("Already rejected");
    const organizer = await this.organizerModel.findById(doc.organizerId);
    if (!organizer) throw new NotFoundException("Organizer no longer exists");
    const event = (await this.eventModel.findById(doc.eventId).lean()) as any;
    if (!event) throw new NotFoundException("Event no longer exists");

    doc.status = "confirmed";
    doc.confirmedAt = new Date();
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    await doc.save();

    // Mirror into the existing organizer_payments ledger so the existing
    // super-admin OrganizerBillingDialog "Total paid / Outstanding" math
    // continues to work without changes there.
    try {
      await this.organizerPaymentModel.create({
        organizerId: doc.organizerId,
        amount: doc.amount,
        paidOn: doc.confirmedAt,
        note: `Event-fee payment ${doc.ref} for event "${event.title || ""}"`,
        recordedBy: adminId ? new Types.ObjectId(adminId) : undefined,
      });
    } catch (e: any) {
      this.logger.warn(
        `Ledger mirror failed for billing payment ${doc._id}: ${e?.message || e}`,
      );
    }

    const pdfPath = await this.writeReceiptPdf(organizer, event, doc);
    const whatsapp = await this.sendWhatsAppReceipt(organizer, doc, pdfPath);
    const email = await this.sendEmailReceipt(organizer, event, doc, pdfPath);

    return {
      ok: true,
      receiptPath: "/" + pdfPath.replace(/\\/g, "/").replace(/^\.?\//, ""),
      whatsapp,
      email,
    };
  }

  async reject(id: string, reason?: string, adminId?: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Payment request not found");
    if (doc.status === "confirmed")
      throw new ConflictException("Already confirmed; cannot reject");
    doc.status = "rejected";
    doc.rejectionReason = (reason || "").slice(0, 500);
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    doc.confirmedAt = new Date();
    await doc.save();
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  //  Receipt helpers (mirror the subscription module so the look is uniform).
  // ---------------------------------------------------------------------------
  private currencySymbol(currency: string) {
    if (currency === "INR") return "Rs.";
    if (currency === "SGD") return "S$";
    return "$";
  }

  private writeReceiptPdf(
    organizer: any,
    event: any,
    doc: any,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.join(process.cwd(), "uploads", "receipts");
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
      const filePath = path.join(dir, `${doc.ref}.pdf`);
      const stream = fs.createWriteStream(filePath);
      const pdf = new PDFDocument({ size: "A4", margin: 40 });
      pdf.pipe(stream);

      const C = {
        ink: "#0f172a",
        body: "#1f2937",
        muted: "#64748b",
        line: "#e2e8f0",
        zebra: "#f8fafc",
        accentBg: "#0f172a",
        accentInk: "#ffffff",
        good: "#16a34a",
        goodBg: "#dcfce7",
      };
      const pageLeft = 40;
      const pageRight = 595 - 40;
      const usable = pageRight - pageLeft;
      const sym = this.currencySymbol(doc.currency);
      const amountStr = `${sym}${doc.amount.toFixed(2)} ${doc.currency}`;
      const issued = new Date().toLocaleString();
      const evDate = event.startDate
        ? new Date(event.startDate).toLocaleDateString()
        : "—";

      // Header band
      pdf.rect(pageLeft, 40, usable, 70).fill(C.accentBg);
      pdf
        .fillColor(C.accentInk)
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("EVENTSH", pageLeft + 18, 55);
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text("Event-fee receipt", pageLeft + 18, 82);
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(C.accentInk)
        .text("EVENT PAYMENT RECEIPT", pageLeft, 55, {
          width: usable - 18,
          align: "right",
        });
      pdf
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#cbd5e1")
        .text(`Ref: ${doc.ref}`, pageLeft, 75, {
          width: usable - 18,
          align: "right",
        })
        .text(`Issued: ${issued}`, pageLeft, 88, {
          width: usable - 18,
          align: "right",
        });

      let y = 130;

      // Bill-to + Payment-details boxes
      const colW = (usable - 12) / 2;
      const billToX = pageLeft;
      const payX = pageLeft + colW + 12;
      const boxH = 90;
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("BILLED TO", billToX, y)
        .text("PAYMENT DETAILS", payX, y);
      pdf
        .lineWidth(0.6)
        .strokeColor(C.line)
        .rect(billToX, y + 14, colW, boxH)
        .stroke();
      pdf.rect(payX, y + 14, colW, boxH).stroke();
      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(C.ink)
        .text(
          organizer.organizationName || organizer.name || "—",
          billToX + 10,
          y + 22,
          { width: colW - 20 },
        );
      pdf
        .font("Helvetica")
        .fontSize(9.5)
        .fillColor(C.body)
        .text(organizer.name || "", billToX + 10, y + 38, {
          width: colW - 20,
        })
        .text(
          organizer.email || organizer.businessEmail || "—",
          billToX + 10,
          y + 52,
          { width: colW - 20 },
        )
        .text(
          organizer.whatsAppNumber
            ? `WhatsApp: ${organizer.whatsAppNumber}`
            : "",
          billToX + 10,
          y + 66,
          { width: colW - 20 },
        );
      if (organizer.country) {
        pdf
          .fontSize(9)
          .fillColor(C.muted)
          .text(`Country: ${organizer.country}`, billToX + 10, y + 82, {
            width: colW - 20,
          });
      }
      const payRows: Array<[string, string]> = [
        ["Reference", doc.ref],
        [
          "Method",
          doc.scheme === "UPI" ? "UPI (India)" : "PayNow (Singapore)",
        ],
        ["Currency", doc.currency],
        ["Amount", amountStr],
        ["Event date", evDate],
      ];
      payRows.forEach(([k, v], i) => {
        const ry = y + 22 + i * 14;
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.muted)
          .text(k, payX + 10, ry, { width: 72 });
        pdf
          .font("Helvetica-Bold")
          .fontSize(9.5)
          .fillColor(C.body)
          .text(v, payX + 10 + 75, ry, { width: colW - 95 });
      });
      y += 14 + boxH + 24;

      // Items table: event with counts
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ITEMS PAID FOR", pageLeft, y);
      y += 14;
      const cols = [
        {
          x: pageLeft,
          w: usable * 0.55,
          label: "DESCRIPTION",
          align: "left" as const,
        },
        {
          x: pageLeft + usable * 0.55,
          w: usable * 0.2,
          label: "QTY",
          align: "center" as const,
        },
        {
          x: pageLeft + usable * 0.75,
          w: usable * 0.25,
          label: "AMOUNT",
          align: "right" as const,
        },
      ];
      pdf.rect(pageLeft, y, usable, 22).fill(C.accentBg);
      cols.forEach((c) =>
        pdf
          .fillColor(C.accentInk)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(c.label, c.x + 8, y + 7, { width: c.w - 16, align: c.align }),
      );
      y += 22;

      const lineItems: Array<{ desc: string; qty: number }> = [
        { desc: "Booked stalls", qty: doc.stallsSold || 0 },
        { desc: "Booked round tables", qty: doc.tablesBooked || 0 },
        { desc: "Booked chairs", qty: doc.chairsBooked || 0 },
        { desc: "Confirmed speakers", qty: doc.speakersBooked || 0 },
      ].filter((r) => r.qty > 0);
      // Always print at least one row so the table doesn't look broken.
      const printItems = lineItems.length
        ? lineItems
        : [{ desc: "Event fees", qty: 1 }];

      pdf.font("Helvetica").fontSize(10).fillColor(C.body);
      printItems.forEach((it, i) => {
        const fill = i % 2 === 0 ? "#ffffff" : C.zebra;
        const rowH = 22;
        pdf.rect(pageLeft, y, usable, rowH).fillAndStroke(fill, C.line);
        pdf
          .fillColor(C.body)
          .font("Helvetica")
          .fontSize(10.5)
          .text(`${event.title || "Event"} — ${it.desc}`, cols[0].x + 8, y + 6, {
            width: cols[0].w - 16,
          });
        pdf.text(String(it.qty), cols[1].x + 8, y + 6, {
          width: cols[1].w - 16,
          align: "center",
        });
        // amount per-line isn't stored — leave the right column blank for
        // sub-rows and show the total in the total row below.
        pdf.text("", cols[2].x + 8, y + 6, {
          width: cols[2].w - 16,
          align: "right",
        });
        y += rowH;
      });

      // Total
      const totalH = 26;
      pdf.rect(pageLeft, y, usable, totalH).fillAndStroke("#ffffff", C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(C.muted)
        .text("TOTAL PAID", cols[1].x + 8, y + 9, {
          width: cols[1].w - 16,
          align: "right",
        });
      pdf
        .fillColor(C.ink)
        .fontSize(12)
        .text(amountStr, cols[2].x + 8, y + 7, {
          width: cols[2].w - 16,
          align: "right",
        });
      y += totalH + 18;

      // Paid pill footer
      pdf.rect(pageLeft, y, usable, 44).fillAndStroke(C.zebra, C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("STATUS", pageLeft + 14, y + 10);
      pdf
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(C.ink)
        .text(
          `Settled for "${event.title || "Event"}"`,
          pageLeft + 14,
          y + 22,
          { width: usable / 2 + 80 },
        );
      const pillW = 60;
      const pillX = pageRight - pillW - 14;
      pdf
        .roundedRect(pillX, y + 14, pillW, 18, 9)
        .fillAndStroke(C.goodBg, C.good);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.good)
        .text("PAID", pillX, y + 19, { width: pillW, align: "center" });
      y += 44 + 18;

      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text(
          "This is an electronically generated receipt — no signature required.",
          pageLeft,
          y,
          { width: usable, align: "center" },
        );

      pdf.end();
      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    });
  }

  private async sendWhatsAppReceipt(
    organizer: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    if (!organizer.whatsAppNumber)
      return { sent: false, error: "no_whatsapp_number" };
    try {
      const caption = `Eventsh — event fee payment confirmed. Receipt attached. Ref: ${doc.ref}`;
      await this.otpService.sendMediaMessage(
        organizer.whatsAppNumber,
        pdfPath,
        caption,
      );
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `WhatsApp receipt failed for billing-payment ${doc._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private async sendEmailReceipt(
    organizer: any,
    event: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const to = organizer.email || organizer.businessEmail;
    if (!to) return { sent: false, error: "no_email" };
    try {
      const symbol = this.currencySymbol(doc.currency);
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
          <h2>Event fee paid</h2>
          <p>Hi ${this.escapeHtml(organizer.name || "there")},</p>
          <p>Your event-fee payment for <strong>${this.escapeHtml(
            event.title || "Event",
          )}</strong> has been confirmed. PDF receipt attached.</p>
          <table style="border-collapse: collapse; margin: 12px 0;">
            <tr><td style="padding: 4px 12px; color: #6b7280;">Amount</td><td style="padding: 4px 12px; font-weight: 600;">${symbol}${doc.amount} ${doc.currency}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Booked stalls</td><td style="padding: 4px 12px; font-weight: 600;">${doc.stallsSold || 0}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Booked tables</td><td style="padding: 4px 12px; font-weight: 600;">${doc.tablesBooked || 0}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Booked chairs</td><td style="padding: 4px 12px; font-weight: 600;">${doc.chairsBooked || 0}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Speakers</td><td style="padding: 4px 12px; font-weight: 600;">${doc.speakersBooked || 0}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Reference</td><td style="padding: 4px 12px; font-family: monospace;">${this.escapeHtml(doc.ref)}</td></tr>
          </table>
          <p>— The Eventsh Team</p>
        </div>`;
      await this.mailService.sendEmail({
        to,
        subject: `Eventsh — Event fee paid (${doc.ref})`,
        html,
        attachments: [
          {
            filename: `eventsh-event-receipt-${doc.ref}.pdf`,
            content: fs.readFileSync(pdfPath),
          },
        ],
      });
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `Email receipt failed for billing-payment ${doc._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private escapeHtml(s: string): string {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private toClient(row: any, event: any) {
    return {
      _id: String(row._id),
      eventId: String(row.eventId),
      eventTitle: event?.title,
      amount: row.amount,
      currency: row.currency,
      scheme: row.scheme,
      ref: row.ref,
      status: row.status,
      submittedAt: row.submittedAt || null,
      createdAt: row.createdAt,
    };
  }
}
