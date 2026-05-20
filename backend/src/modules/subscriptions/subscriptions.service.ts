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
// pdfkit ships without @types; use require to skip the missing-type error
// (matches the qrcode-reader pattern already used in payments.service.ts).
const PDFDocument = require("pdfkit");

interface InitiateBody {
  planId: string;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel("PendingSubscriptionPayment")
    private pendingModel: Model<any>,
    @InjectModel("Plan") private planModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Resolve the right price for the organizer's region.
   * IN-country → priceINR (currency INR, UPI scheme); everything else → price
   * (currency USD; we route through PayNow on SG and treat USD as the QR
   * face value — the QR generator accepts USD by mapping it to "840").
   */
  private resolveCharge(plan: any, country?: string) {
    const isIN = country === "IN" || country === "India";
    if (isIN) {
      const amount = Number(plan.priceINR || 0);
      return { amount, currency: "INR", scheme: "UPI" as const };
    }
    const isSG = country === "SG" || country === "Singapore" || country === "SGP";
    return {
      amount: Number(plan.price || 0),
      currency: isSG ? "SGD" : "USD",
      scheme: isSG ? ("PAYNOW" as const) : ("PAYNOW" as const),
    };
  }

  async initiate(organizerId: string, body: InitiateBody) {
    if (!body?.planId) throw new BadRequestException("planId required");
    const organizer = (await this.organizerModel
      .findById(organizerId)
      .lean()) as any;
    if (!organizer) throw new NotFoundException("Organizer not found");
    const plan = (await this.planModel.findById(body.planId).lean()) as any;
    if (!plan || !plan.isActive)
      throw new NotFoundException("Plan not found or inactive");

    const { amount, currency, scheme } = this.resolveCharge(
      plan,
      organizer.country,
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        "This plan has no price for your region — switch directly without checkout.",
      );
    }

    // Block double-submit: if there's already an open request, return it
    // instead of creating a second row.
    const existing = (await this.pendingModel
      .findOne({
        organizerId,
        status: { $in: ["awaiting_payment", "submitted"] },
      })
      .lean()) as any;
    if (existing) {
      return this.toClient(existing, plan);
    }

    const ref = `SUB-${String(organizerId).slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const doc = await this.pendingModel.create({
      organizerId,
      planId: plan._id,
      amount,
      currency,
      scheme,
      ref,
      status: "awaiting_payment",
    });
    return this.toClient(doc.toObject(), plan);
  }

  async markSubmitted(organizerId: string, id: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Subscription request not found");
    if (String(doc.organizerId) !== String(organizerId)) {
      throw new BadRequestException("Not your subscription request");
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

  async listPending() {
    const rows = await this.pendingModel
      .find({ status: { $in: ["awaiting_payment", "submitted"] } })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    if (rows.length === 0) return [];
    const orgIds = Array.from(new Set(rows.map((r: any) => String(r.organizerId))));
    const planIds = Array.from(new Set(rows.map((r: any) => String(r.planId))));
    const [orgs, plans] = await Promise.all([
      this.organizerModel
        .find({ _id: { $in: orgIds } })
        .select("name organizationName email whatsAppNumber country")
        .lean(),
      this.planModel
        .find({ _id: { $in: planIds } })
        .select("planName price priceINR validityInDays")
        .lean(),
    ]);
    const orgMap = new Map(orgs.map((o: any) => [String(o._id), o]));
    const planMap = new Map(plans.map((p: any) => [String(p._id), p]));
    return rows.map((r: any) => ({
      _id: String(r._id),
      organizer: orgMap.get(String(r.organizerId)) || null,
      plan: planMap.get(String(r.planId)) || null,
      amount: r.amount,
      currency: r.currency,
      scheme: r.scheme,
      status: r.status,
      ref: r.ref,
      submittedAt: r.submittedAt || null,
      createdAt: r.createdAt,
    }));
  }

  async confirm(id: string, adminId?: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Subscription request not found");
    if (doc.status === "confirmed") {
      throw new ConflictException("Already confirmed");
    }
    if (doc.status === "rejected") {
      throw new ConflictException("Already rejected");
    }
    const plan = await this.planModel.findById(doc.planId);
    if (!plan || !plan.isActive)
      throw new NotFoundException("Plan no longer available");
    const organizer = await this.organizerModel.findById(doc.organizerId);
    if (!organizer) throw new NotFoundException("Organizer no longer exists");

    // Activate plan — mirrors organizers.service.ts:addSubscriptionPlan
    organizer.subscribed = true;
    organizer.planId = plan._id;
    organizer.planStartDate = new Date();
    organizer.planExpiryDate = new Date(
      organizer.planStartDate.getTime() +
        plan.validityInDays * 24 * 60 * 60 * 1000,
    );
    organizer.pricePaid = String(doc.amount);
    await organizer.save();

    doc.status = "confirmed";
    doc.confirmedAt = new Date();
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    await doc.save();

    // Generate the PDF receipt once and ship it via WhatsApp + email.
    // Both are best-effort — confirmation already succeeded, so a delivery
    // failure shouldn't roll back the plan activation. We DO surface the
    // status on the response so admin can see what went out.
    const pdfPath = await this.writeReceiptPdf(organizer, plan, doc);
    const whatsapp = await this.sendWhatsAppReceipt(organizer, doc, pdfPath);
    const email = await this.sendEmailReceipt(organizer, plan, doc, pdfPath);

    return {
      ok: true,
      organizerId: String(organizer._id),
      receiptPath: "/" + pdfPath.replace(/\\/g, "/").replace(/^\.?\//, ""),
      whatsapp,
      email,
    };
  }

  async reject(id: string, reason?: string, adminId?: string) {
    const doc = await this.pendingModel.findById(id);
    if (!doc) throw new NotFoundException("Subscription request not found");
    if (doc.status === "confirmed")
      throw new ConflictException("Already confirmed; cannot reject");
    doc.status = "rejected";
    doc.rejectionReason = (reason || "").slice(0, 500);
    if (adminId) doc.confirmedBy = new Types.ObjectId(adminId);
    doc.confirmedAt = new Date();
    await doc.save();
    return { ok: true };
  }

  // ----- helpers -----

  private toClient(row: any, plan: any) {
    return {
      _id: String(row._id),
      planId: String(row.planId),
      planName: plan?.planName,
      amount: row.amount,
      currency: row.currency,
      scheme: row.scheme,
      ref: row.ref,
      status: row.status,
      submittedAt: row.submittedAt || null,
      createdAt: row.createdAt,
    };
  }

  private currencySymbol(currency: string) {
    if (currency === "INR") return "Rs.";
    if (currency === "SGD") return "S$";
    return "$";
  }

  /**
   * Build an invoice-style PDF receipt and persist it under
   * uploads/receipts/<ref>.pdf so it can be attached to email and shipped
   * via the WhatsApp media path. Layout:
   *   - branded header with reference + issue date
   *   - Bill-To and Payment Details two-column box
   *   - line-items table with column headers and totals row
   *   - included-features table (numbered)
   *   - footer with validity + active-status pill
   * pdfkit currency note: the built-in Helvetica WinAnsi encoding doesn't
   * include the rupee glyph (₹) — INR amounts use "Rs." so the PDF
   * doesn't show a missing-glyph box.
   */
  private writeReceiptPdf(organizer: any, plan: any, doc: any): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = path.join(process.cwd(), "uploads", "receipts");
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore — usually exists
      }
      const filePath = path.join(dir, `${doc.ref}.pdf`);
      const stream = fs.createWriteStream(filePath);
      const pdf = new PDFDocument({ size: "A4", margin: 40 });
      pdf.pipe(stream);

      // ----- palette + layout constants ---------------------------------
      const C = {
        ink: "#0f172a",          // slate-900
        body: "#1f2937",         // slate-800
        muted: "#64748b",        // slate-500
        line: "#e2e8f0",         // slate-200
        zebra: "#f8fafc",        // slate-50
        accentBg: "#0f172a",     // dark band header
        accentInk: "#ffffff",
        good: "#16a34a",         // green-600
        goodBg: "#dcfce7",       // green-100
      };
      const pageLeft = 40;
      const pageRight = 595 - 40; // A4 width in pts
      const usable = pageRight - pageLeft;

      const symbol = this.currencySymbol(doc.currency);
      const amountStr = `${symbol}${doc.amount.toFixed(2)} ${doc.currency}`;
      const issued = new Date().toLocaleString();
      const validTill = organizer.planExpiryDate
        ? new Date(organizer.planExpiryDate).toLocaleDateString()
        : "—";
      const methodLabel =
        doc.scheme === "UPI" ? "UPI (India)" : "PayNow (Singapore)";

      // ----- header band ------------------------------------------------
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
        .text("Event management platform", pageLeft + 18, 82);
      // right side: receipt title + meta
      pdf
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(C.accentInk)
        .text("PAYMENT RECEIPT", pageLeft, 55, {
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

      // ----- Bill-To + Payment Details two-column box ------------------
      const colW = (usable - 12) / 2;
      const billToX = pageLeft;
      const payX = pageLeft + colW + 12;
      const boxH = 90;

      // titles
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("BILLED TO", billToX, y)
        .text("PAYMENT DETAILS", payX, y);

      // boxes
      pdf
        .lineWidth(0.6)
        .strokeColor(C.line)
        .rect(billToX, y + 14, colW, boxH)
        .stroke();
      pdf.rect(payX, y + 14, colW, boxH).stroke();

      // bill-to body
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
        .text(organizer.email || organizer.businessEmail || "—", billToX + 10, y + 52, {
          width: colW - 20,
        })
        .text(
          organizer.whatsAppNumber ? `WhatsApp: ${organizer.whatsAppNumber}` : "",
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

      // payment-details body — key/value rows
      const payRows: Array<[string, string]> = [
        ["Reference", doc.ref],
        ["Method", methodLabel],
        ["Currency", doc.currency],
        ["Amount", amountStr],
        ["Issued", issued],
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

      // ----- Line items table ------------------------------------------
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ITEMS", pageLeft, y);
      y += 14;

      const cols = [
        { x: pageLeft, w: usable * 0.55, label: "DESCRIPTION", align: "left" as const },
        {
          x: pageLeft + usable * 0.55,
          w: usable * 0.2,
          label: "PERIOD",
          align: "center" as const,
        },
        {
          x: pageLeft + usable * 0.75,
          w: usable * 0.25,
          label: "AMOUNT",
          align: "right" as const,
        },
      ];

      // header row
      pdf.rect(pageLeft, y, usable, 22).fill(C.accentBg);
      cols.forEach((c) => {
        pdf
          .fillColor(C.accentInk)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(c.label, c.x + 8, y + 7, {
            width: c.w - 16,
            align: c.align,
          });
      });
      y += 22;

      // body row(s) — just the plan line for now
      const descText = plan.description
        ? `${plan.planName}\n${plan.description}`
        : plan.planName;
      pdf
        .font("Helvetica")
        .fontSize(10)
        .fillColor(C.body);
      // measure desc height with wrapping at the desc column width
      const descH = pdf.heightOfString(descText, {
        width: cols[0].w - 16,
      });
      const rowH = Math.max(34, descH + 14);
      pdf.rect(pageLeft, y, usable, rowH).fillAndStroke(C.zebra, C.line);
      pdf
        .fillColor(C.ink)
        .font("Helvetica-Bold")
        .fontSize(10.5)
        .text(plan.planName, cols[0].x + 8, y + 8, {
          width: cols[0].w - 16,
        });
      if (plan.description) {
        pdf
          .font("Helvetica")
          .fontSize(9)
          .fillColor(C.muted)
          .text(plan.description, cols[0].x + 8, y + 22, {
            width: cols[0].w - 16,
          });
      }
      pdf
        .fillColor(C.body)
        .font("Helvetica")
        .fontSize(10.5)
        .text(`${plan.validityInDays} days`, cols[1].x + 8, y + 12, {
          width: cols[1].w - 16,
          align: "center",
        })
        .font("Helvetica-Bold")
        .text(amountStr, cols[2].x + 8, y + 12, {
          width: cols[2].w - 16,
          align: "right",
        });
      y += rowH;

      // totals row
      const totalRowH = 26;
      pdf
        .rect(pageLeft, y, usable, totalRowH)
        .fillAndStroke("#ffffff", C.line);
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
      y += totalRowH + 18;

      // ----- Included features table -----------------------------------
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("INCLUDED IN THIS PLAN", pageLeft, y);
      y += 14;

      const features: string[] =
        Array.isArray(plan.features) && plan.features.length
          ? plan.features
          : ["(no features listed)"];
      const featCols = [
        { x: pageLeft, w: 32, label: "#", align: "center" as const },
        {
          x: pageLeft + 32,
          w: usable - 32,
          label: "FEATURE",
          align: "left" as const,
        },
      ];
      pdf.rect(pageLeft, y, usable, 20).fill(C.accentBg);
      featCols.forEach((c) => {
        pdf
          .fillColor(C.accentInk)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(c.label, c.x + 8, y + 6, {
            width: c.w - 16,
            align: c.align,
          });
      });
      y += 20;

      pdf.font("Helvetica").fontSize(10).fillColor(C.body);
      features.forEach((f, i) => {
        // page-overflow guard — start a new page if we'd cross the margin
        if (y > 760) {
          pdf.addPage();
          y = 50;
        }
        const fh =
          pdf.heightOfString(f, { width: featCols[1].w - 16 }) + 12;
        const fill = i % 2 === 0 ? "#ffffff" : C.zebra;
        pdf.rect(pageLeft, y, usable, fh).fillAndStroke(fill, C.line);
        pdf
          .fillColor(C.muted)
          .font("Helvetica")
          .fontSize(10)
          .text(String(i + 1), featCols[0].x + 8, y + 6, {
            width: featCols[0].w - 16,
            align: "center",
          });
        pdf
          .fillColor(C.body)
          .font("Helvetica")
          .fontSize(10)
          .text(f, featCols[1].x + 8, y + 6, {
            width: featCols[1].w - 16,
          });
        y += fh;
      });

      y += 18;
      if (y > 740) {
        pdf.addPage();
        y = 50;
      }

      // ----- Validity footer with status pill --------------------------
      pdf.rect(pageLeft, y, usable, 44).fillAndStroke(C.zebra, C.line);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.muted)
        .text("ACTIVE UNTIL", pageLeft + 14, y + 10);
      pdf
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(C.ink)
        .text(validTill, pageLeft + 14, y + 22, { width: usable / 2 - 14 });
      // status pill on the right
      const pillW = 70;
      const pillX = pageRight - pillW - 14;
      pdf
        .roundedRect(pillX, y + 14, pillW, 18, 9)
        .fillAndStroke(C.goodBg, C.good);
      pdf
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(C.good)
        .text("ACTIVE", pillX, y + 19, {
          width: pillW,
          align: "center",
        });
      y += 44 + 18;

      // ----- Footer note ----------------------------------------------
      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor(C.muted)
        .text(
          "This is an electronically generated receipt — no signature required. " +
            "If you have any questions, reply to the email this receipt was attached to.",
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
    if (!organizer.whatsAppNumber) {
      return { sent: false, error: "no_whatsapp_number" };
    }
    try {
      const caption = `Your Eventsh subscription is active. Receipt attached. Ref: ${doc.ref}`;
      await this.otpService.sendMediaMessage(
        organizer.whatsAppNumber,
        pdfPath,
        caption,
      );
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `WhatsApp receipt failed for org=${organizer._id}: ${e?.message || e}`,
      );
      return { sent: false, error: e?.message || "send failed" };
    }
  }

  private async sendEmailReceipt(
    organizer: any,
    plan: any,
    doc: any,
    pdfPath: string,
  ): Promise<{ sent: boolean; error?: string }> {
    const to = organizer.email || organizer.businessEmail;
    if (!to) return { sent: false, error: "no_email" };
    try {
      const symbol = this.currencySymbol(doc.currency);
      const validTill = organizer.planExpiryDate
        ? new Date(organizer.planExpiryDate).toLocaleDateString()
        : "—";
      const featuresHtml =
        Array.isArray(plan.features) && plan.features.length
          ? `<ul>${plan.features
              .map((f: string) => `<li>${this.escapeHtml(f)}</li>`)
              .join("")}</ul>`
          : "<p><em>(no features listed)</em></p>";
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
          <h2>Subscription activated</h2>
          <p>Hi ${this.escapeHtml(organizer.name || "there")},</p>
          <p>Your <strong>${this.escapeHtml(plan.planName)}</strong> plan is now active. A PDF receipt is attached for your records.</p>
          <table style="border-collapse: collapse; margin: 12px 0;">
            <tr><td style="padding: 4px 12px; color: #6b7280;">Amount paid</td><td style="padding: 4px 12px; font-weight: 600;">${symbol}${doc.amount} ${doc.currency}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Validity</td><td style="padding: 4px 12px; font-weight: 600;">${plan.validityInDays} days</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Active until</td><td style="padding: 4px 12px; font-weight: 600;">${validTill}</td></tr>
            <tr><td style="padding: 4px 12px; color: #6b7280;">Reference</td><td style="padding: 4px 12px; font-family: monospace;">${this.escapeHtml(doc.ref)}</td></tr>
          </table>
          ${plan.description ? `<p>${this.escapeHtml(plan.description)}</p>` : ""}
          <h3>What's included</h3>
          ${featuresHtml}
          <p>— The Eventsh Team</p>
        </div>`;
      await this.mailService.sendEmail({
        to,
        subject: `Eventsh — ${plan.planName} activated (${doc.ref})`,
        html,
        attachments: [
          {
            filename: `eventsh-receipt-${doc.ref}.pdf`,
            content: fs.readFileSync(pdfPath),
          },
        ],
      });
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(
        `Email receipt failed for org=${organizer._id}: ${e?.message || e}`,
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

  private renderReceipt(organizer: any, plan: any, doc: any) {
    const features =
      Array.isArray(plan.features) && plan.features.length
        ? plan.features.map((f: string) => `  • ${f}`).join("\n")
        : "  • (no features listed)";
    const symbol = doc.currency === "INR" ? "₹" : doc.currency === "SGD" ? "S$" : "$";
    const validTill = organizer.planExpiryDate
      ? new Date(organizer.planExpiryDate).toLocaleDateString()
      : "—";
    return [
      `*Eventsh — Subscription Receipt*`,
      ``,
      `Hi ${organizer.name || organizer.organizationName || "there"},`,
      `Your payment has been confirmed. Here are your plan details:`,
      ``,
      `*Plan:* ${plan.planName}`,
      plan.description ? `*About:* ${plan.description}` : null,
      `*Amount paid:* ${symbol}${doc.amount}`,
      `*Validity:* ${plan.validityInDays} days (until ${validTill})`,
      `*Reference:* ${doc.ref}`,
      ``,
      `*Included:*`,
      features,
      ``,
      `Thanks for choosing Eventsh.`,
    ]
      .filter(Boolean)
      .join("\n");
  }
}
