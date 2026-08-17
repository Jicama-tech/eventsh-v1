import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { decryptSecret } from "../../common/secret-crypto.util";

// Per-organizer custom sender. When `enabled` and the SMTP fields are filled,
// emails for that organizer are sent FROM their address via their own server.
export interface OrgEmailConfig {
  enabled?: boolean;
  fromName?: string;
  fromEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
}

@Injectable()
export class MailService {
  private transporter;
  // Cache of per-organizer SMTP transporters, keyed by host|port|user|pass so a
  // credential change transparently spins up a fresh transporter.
  private customTransporters = new Map<string, nodemailer.Transporter>();

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for SSL port 465, false for TLS 587
      auth: {
        user: process.env.SMTP_USER || "attendancemanagement2025@gmail.com",
        pass: process.env.SMTP_PASS || "kigu gpta alwr jbbf",
      },
    });
  }

  // True when the organizer has a usable custom sender configured.
  private isCustomActive(c?: OrgEmailConfig): boolean {
    return !!(
      c &&
      c.enabled &&
      c.smtpHost &&
      c.smtpUser &&
      c.smtpPass &&
      (c.fromEmail || c.smtpUser)
    );
  }

  // Pick the transporter + From header for a given organizer config, falling
  // back to the global EventSH sender when no custom config is active.
  private resolveSender(c?: OrgEmailConfig): {
    transporter: nodemailer.Transporter;
    from: string;
  } {
    if (this.isCustomActive(c)) {
      const port = Number(c!.smtpPort) || 465;
      // Cache key keeps the stored (encrypted) value so the plaintext never
      // sits in the map; the password is decrypted only for the SMTP auth.
      const key = `${c!.smtpHost}|${port}|${c!.smtpUser}|${c!.smtpPass}`;
      let t = this.customTransporters.get(key);
      if (!t) {
        t = nodemailer.createTransport({
          host: c!.smtpHost,
          port,
          secure: c!.smtpSecure ?? port === 465,
          auth: { user: c!.smtpUser, pass: decryptSecret(c!.smtpPass) },
        });
        this.customTransporters.set(key, t);
      }
      const fromEmail = c!.fromEmail || c!.smtpUser!;
      const fromName = (c!.fromName || fromEmail).replace(/"/g, "");
      return { transporter: t, from: `"${fromName}" <${fromEmail}>` };
    }
    return {
      transporter: this.transporter,
      from: `"EventSH" <${process.env.SMTP_USER}>`,
    };
  }

  // Verify a custom config and send a one-off test email. Forces `enabled` so
  // an organizer can test before turning the feature on. Throws on failure so
  // the caller can surface the SMTP error.
  async sendTestEmail(config: OrgEmailConfig, to: string): Promise<void> {
    const { transporter, from } = this.resolveSender({
      ...config,
      enabled: true,
    });
    await transporter.verify();
    await transporter.sendMail({
      from,
      to,
      subject: "EventSH — test email from your address",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#0f172a">It works! ✅</h2>
          <p>This is a test email sent from <strong>${from}</strong> using your own mail server.</p>
          <p>All emails for your events will now be sent from this address.</p>
          <p style="color:#64748b;font-size:12px">— EventSH</p>
        </div>`,
    });
  }

  // ✉️ Send to Admin when a new role application is submitted
  async sendApprovalRequestToAdmin(data: {
    name: string;
    email: string;
    role: string;
  }) {
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || "admin@eventsh.com",
      subject: `Approval Request for New ${data.role}`,
      html: `
        <h1>Approval Needed</h1>
        <p>User <strong>${data.name}</strong> (${data.email}) has applied for the role of <strong>${data.role}</strong>.</p>
        <p>Please log in to the admin dashboard to approve or reject this request.</p>
      `,
    });
  }

  // ✉️ Send to applicant confirming their request is pending
  async sendConfirmationToUser(data: {
    name: string;
    email: string;
    role: string;
  }) {
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject: `Your ${data.role} Registration is Pending`,
      html: `
        <h1>Hello ${data.name},</h1>
        <p>Thank you for applying to become a ${data.role} on our platform.</p>
        <p>Your request has been sent to the admin team for approval. You will receive an email once it's approved.</p>
        <p>Regards,<br/>EventSH Team</p>
      `,
    });
  }

  async sendEnquiryConfirmationToUser(data: {
    firstName: string;
    emailId: string;
    enquiryFor: string;
    organizationName: string;
  }) {
    const enquiryLabelMap: Record<string, string> = {
      events: "Events Management",
    };

    const enquiryLabel = enquiryLabelMap[data.enquiryFor] ?? "EventSH Services";

    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.emailId,
      subject: `We’ve received your enquiry for ${enquiryLabel}`,
      html: `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; line-height: 1.6;">
        <h1 style="font-size: 20px; margin-bottom: 12px;">Hi ${data.firstName},</h1>
        <p style="margin: 0 0 8px;">
          Thank you for reaching out to <strong>EventSH</strong> from <strong>${data.organizationName}</strong>.
        </p>
        <p style="margin: 0 0 8px;">
          Your enquiry for <strong>${enquiryLabel}</strong> has been received successfully.
        </p>
        <p style="margin: 0 0 8px;">
          Our team will review your requirements and get back to you as soon as possible with the next steps.
        </p>
        <p style="margin: 0 0 8px;">
          If you need to share any additional details, you can simply reply to this email.
        </p>
        <p style="margin-top: 16px;">
          Regards,<br/>
          <strong>EventSH Team</strong>
        </p>
      </div>
    `,
    });
  }

  // ✉️ Send status update email (Approved or Rejected)
  async sendStatusUpdate(data: {
    name: string;
    email: string;
    role: string;
    status: "Approved" | "Rejected";
  }) {
    let subject = "";
    let body = "";

    if (data.status === "Approved") {
      if (data.role === "Organizer") {
        subject = `Your ${data.role} Registration is Approved`;
        body = `
          <div style="font-family: sans-serif; max-width: 600px; color: #333;">
        <h1>Congratulations ${data.name}!</h1>
        <p>We are pleased to inform you that your application for the role of <strong>${data.role}</strong> has been 
        <span style="color: #008080; font-weight: bold;">Approved</span>.</p>
        

        <p>Thank You,<br/><strong>The EventSH Team</strong></p>
      </div>`;
      }
    } else if (data.status === "Rejected") {
      if (data.role === "Organizer") {
        subject = `Your ${data.role} Registration is Rejected`;
        body = `
          <h1>Hello ${data.name},</h1>
          <p>We regret to inform you that your application for the role of <strong>${data.role}</strong> has been 
          <span style="color: red; font-weight: bold;">Rejected</span>.</p>
          <p>If you believe this is a mistake or would like to appeal, please contact our support team.</p>
          <p>Regards,<br/>EventSH Team</p>
        `;
      }
    }

    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  // ✉️ Send email when a new admin is created
  async sendNewAdminCredentials(data: {
    name: string;
    email: string;
    password: string;
    createdBy: string;
  }) {
    const subject = "Welcome to EventSH - Your Admin Account";

    const body = `
    <h1>Welcome, ${data.name}!</h1>
    <p>You have been added as an <strong>Admin</strong> on the <strong>EventSH</strong> platform by <strong>${data.createdBy}</strong>.</p>
    <h2>Your Login Credentials:</h2>
    <ul>
      <li><strong>Email:</strong> ${data.email}</li>
      <li><strong>Temporary Password:</strong> ${data.password}</li>
    </ul>
    <p><strong>Note:</strong> Please log in immediately and change your password from your profile settings.</p>
    <p>Access the Admin Dashboard here: <a href="http://your-admin-dashboard-url.com">Login Now</a></p>
    <br/>
    <p>Best regards,<br/>EventSH Team</p>
  `;

    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  // `senderConfig` (organizer's emailConfig) makes attendee/vendor-facing OTPs
  // go out from the organizer's custom address when their toggle is on.
  async sendOtpEmail(
    businessEmail: string,
    otp: string,
    senderConfig?: OrgEmailConfig,
  ) {
    const { transporter, from } = this.resolveSender(senderConfig);
    await transporter.sendMail({
      from,
      to: businessEmail,
      subject: "Your OTP Code for Business Email Verification",
      html: `
      <h1>Your OTP Code</h1>
      <p>Use the following OTP to verify your business email address:</p>
      <h2 style="letter-spacing: 4px;">${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
      <br/>
      <p>Regards,<br/>EventSH Team</p>
    `,
    });
  }

  async sendOTPEmail(data: {
    name: string;
    email: string;
    otp: string;
    businessName: string;
  }) {
    await this.transporter.sendMail({
      from: `"EventSH Security" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject: `Your EventSH Login Verification Code - ${data.otp}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>EventSH - Login Verification</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .header { background: linear-gradient(135deg, #1e293b 0%, #374151 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .otp-box { background: #f8fafc; border: 2px solid #e5e7eb; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
            .otp-code { font-size: 36px; font-weight: bold; color: #1e293b; letter-spacing: 8px; margin: 20px 0; font-family: 'Courier New', monospace; }
            .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 8px; }
            .footer { text-align: center; padding: 30px; color: #6b7280; font-size: 14px; background: #f9fafb; border-radius: 0 0 10px 10px; }
            .security-info { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .btn { display: inline-block; padding: 15px 30px; background: #1e293b; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 10px 0; }
            .logo { width: 60px; height: 60px; background: white; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 24px; font-weight: bold; color: #1e293b; }
            .business-info { background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; }
            .expiry-info { color: #dc2626; font-weight: bold; margin: 15px 0; }
            .steps { text-align: left; margin: 25px 0; }
            .step { margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">ES</div>
              <h1 style="margin: 0; font-size: 28px;">EventSH</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure Login Verification</p>
            </div>
            
            <div class="content">
              <h2 style="color: #1e293b; margin-bottom: 20px;">Hello ${data.name},</h2>
              
              <div class="business-info">
                <strong>🏪 Business:</strong> ${data.businessName}<br>
                <strong>📧 Account:</strong> ${data.email}<br>
                <strong>🕒 Requested:</strong> ${new Date().toLocaleString()}
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151;">
                We received a request to access your EventSH Dashboard. Please use the verification code below to complete your login:
              </p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                <div class="otp-code">${data.otp}</div>
                <div class="expiry-info">⏰ Expires in 10 minutes</div>
              </div>
              
              <div class="steps">
                <h3 style="color: #1e293b; margin-bottom: 15px;">How to use this code:</h3>
                <div class="step">
                  <strong>Step 1:</strong> Return to the EventSH login page
                </div>
                <div class="step">
                  <strong>Step 2:</strong> Enter the 6-digit code above
                </div>
                <div class="step">
                  <strong>Step 3:</strong> Click "Verify & Login" to access your dashboard
                </div>
              </div>
              
              <div class="security-info">
                <h4 style="margin-top: 0; color: #065f46;">🔒 Security Information</h4>
                <ul style="margin: 10px 0; padding-left: 20px; color: #374151;">
                  <li>This code is valid for <strong>10 minutes only</strong></li>
                  <li>Maximum <strong>3 attempts</strong> allowed</li>
                  <li>Never share this code with anyone</li>
                  <li>EventSH will never ask for your OTP via phone or chat</li>
                </ul>
              </div>
              
              <div class="warning-box">
                <h4 style="margin-top: 0; color: #92400e;">⚠️ Didn't request this?</h4>
                <p style="margin-bottom: 0; color: #92400e;">
                  If you didn't request this login code, someone may be trying to access your account. Please change your password immediately and contact our support team.
                </p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-top: 30px;">
                If you're having trouble logging in, you can request a new verification code or contact our support team for assistance.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_BASE_URL || "https://eventsh.com"}/support" class="btn">Contact Support</a>
              </div>
            </div>

            <div class="footer">
              <p style="margin: 0 0 10px 0;"><strong>EventSH - Events Management Platform</strong></p>
              <p style="margin: 0 0 15px 0;">This is an automated security email. Please do not reply to this message.</p>
              <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                © ${new Date().getFullYear()} EventSH. All rights reserved.<br>
                If you have questions, contact us at <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || "support@eventsh.com"}" style="color: #4f46e5;">${process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL || "support@eventsh.com"}</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  }

  // ✅ Welcome email after a successful organizer registration
  async sendOrganizerWelcome(data: {
    name: string;
    email: string;
    organizationName: string;
    planName?: string | null;
    validityInDays?: number | null;
  }) {
    const subject = `Welcome to EventSH, ${data.organizationName}!`;
    const planLine =
      data.planName && data.validityInDays
        ? `<p>You've been auto-assigned the <strong>${data.planName}</strong> plan (valid for ${data.validityInDays} days). You can upgrade anytime from <em>Settings → Subscription</em>.</p>`
        : `<p>You can browse plans anytime from <em>Settings → Subscription</em>.</p>`;
    const loginUrl = `${process.env.FRONTEND_BASE_URL || "https://eventsh.com"}/login`;
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
        <h2>Welcome aboard, ${data.name}! 🎉</h2>
        <p>Your organizer account for <strong>${data.organizationName}</strong> is live and active.</p>
        ${planLine}
        <p>Log in via WhatsApp OTP at <a href="${loginUrl}">${loginUrl}</a> to start creating events.</p>
        <p>Cheers,<br/>The EventSH Team</p>
      </div>`;
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  // ✅ Receipt of plan switch / purchase
  /**
   * Sponsorship invoice, sent once the organizer verifies the transfer.
   *
   * `senderConfig` is the organizer's email config — when they've set up their
   * own SMTP the invoice comes from their address, otherwise it falls back to
   * the shared EventSH sender.
   */
  async sendSponsorshipInvoice(
    data: {
      to: string | string[];
      /** Invoice PDF to attach, built by the caller. */
      pdf?: Buffer;
      companyName: string;
      contactName?: string;
      eventTitle: string;
      eventDate?: Date | string;
      tierName: string;
      amount: number;
      currencySymbol: string;
      invoiceNumber: string;
      transactionId?: string;
      paidOn?: Date;
      organizationName?: string;
      organizerEmail?: string;
    },
    senderConfig?: OrgEmailConfig,
  ): Promise<void> {
    const { transporter, from } = this.resolveSender(senderConfig);
    const money = `${data.currencySymbol}${Number(data.amount || 0).toLocaleString()}`;
    const issuer = data.organizationName || "the organizer";
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 14px;color:#6b7280;">${label}</td><td style="padding:6px 14px;font-weight:600;">${value}</td></tr>`;

    const subject = `Sponsorship invoice ${data.invoiceNumber} — ${data.eventTitle}`;
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
        <h2 style="margin-bottom:4px;">Sponsorship confirmed 🤝</h2>
        <p style="color:#6b7280;margin-top:0;">Invoice ${data.invoiceNumber}</p>
        <p>Hi ${data.contactName || data.companyName},</p>
        <p>
          Thank you for sponsoring <strong>${data.eventTitle}</strong>.
          ${issuer} has verified your payment and your sponsorship is now confirmed.
        </p>
        <table style="border-collapse:collapse;margin:16px 0;border:1px solid #e5e7eb;border-radius:8px;">
          ${row("Sponsor", data.companyName)}
          ${row("Package", data.tierName)}
          ${row("Amount paid", money)}
          ${data.transactionId ? row("Transaction ref", data.transactionId) : ""}
          ${data.paidOn ? row("Paid on", new Date(data.paidOn).toLocaleDateString()) : ""}
          ${data.eventDate ? row("Event date", new Date(data.eventDate).toLocaleDateString()) : ""}
          ${row("Invoice no.", data.invoiceNumber)}
        </table>
        <p>Keep this email as your receipt.${
          data.organizerEmail
            ? ` Any questions, reply here or write to <a href="mailto:${data.organizerEmail}">${data.organizerEmail}</a>.`
            : ""
        }</p>
        <p style="color:#6b7280;font-size:13px;">— ${data.organizationName || "EventSH"}</p>
      </div>`;

    // Both addresses on one send — the sponsor's sign-in Gmail and their
    // company/accounts address — so finance and the contact both get it.
    const recipients = (Array.isArray(data.to) ? data.to : [data.to])
      .map((e) => (e || "").trim().toLowerCase())
      .filter(Boolean);
    const to = [...new Set(recipients)].join(", ");

    await transporter.sendMail({
      from,
      to,
      subject,
      html: body,
      attachments: data.pdf
        ? [
            {
              filename: `${data.invoiceNumber}.pdf`,
              content: data.pdf,
              contentType: "application/pdf",
            },
          ]
        : [],
    });
  }

  /**
   * One email shape for every step of a supplier quotation — new quote,
   * counter-offer, approval, rejection, part/full payment, and the supplier's
   * own invoice confirmation.
   *
   * Negotiations can run for many rounds, so each message leads with what
   * just changed and carries the current figures underneath. Sent from the
   * organizer's own SMTP when configured, otherwise the shared EventSH sender.
   */
  async sendSupplierUpdate(
    data: {
      to: string[];
      heading: string;
      /** One-line summary of what just happened. */
      summary: string;
      supplierName: string;
      eventTitle: string;
      status: string;
      /** Label → value rows rendered as a table (already formatted). */
      rows?: Array<[string, string]>;
      /** Free-text note from whoever made the change. */
      note?: string;
      organizationName?: string;
      ctaLabel?: string;
      ctaUrl?: string;
    },
    senderConfig?: OrgEmailConfig,
  ): Promise<void> {
    const recipients = [...new Set(
      (data.to || [])
        .map((e) => String(e || "").trim().toLowerCase())
        .filter(Boolean),
    )];
    if (recipients.length === 0) return;

    const { transporter, from } = this.resolveSender(senderConfig);
    const row = ([label, value]: [string, string]) =>
      `<tr><td style="padding:5px 14px 5px 0;color:#64748b">${label}</td><td style="padding:5px 0;font-weight:600;color:#0f172a">${value || "—"}</td></tr>`;

    const subject = `${data.heading} — ${data.eventTitle}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 620px; color: #1f2937; line-height: 1.6;">
        <h2 style="margin-bottom:4px;">${data.heading}</h2>
        <p style="margin-top:0;color:#6b7280;">${data.summary}</p>
        <table style="border-collapse:collapse;margin:14px 0;">
          ${row(["Supplier", data.supplierName])}
          ${row(["Event", data.eventTitle])}
          ${row(["Status", data.status])}
          ${(data.rows || []).map(row).join("")}
        </table>
        ${
          data.note
            ? `<p style="background:#f1f5f9;border-radius:8px;padding:10px 12px;margin:12px 0;"><strong>Note:</strong> ${data.note}</p>`
            : ""
        }
        ${
          data.ctaUrl
            ? `<p style="margin:18px 0;"><a href="${data.ctaUrl}" style="background:#6366f1;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">${data.ctaLabel || "Open"}</a></p>`
            : ""
        }
        <p style="color:#6b7280;font-size:13px;">— ${data.organizationName || "EventSH"}</p>
      </div>`;

    await transporter.sendMail({
      from,
      to: recipients.join(", "),
      subject,
      html,
    });
  }

  async sendPlanPurchaseConfirmation(data: {
    name: string;
    email: string;
    organizationName: string;
    planName: string;
    pricePaid: string;
    validityInDays: number;
    expiryDate: Date;
  }) {
    const subject = `Plan activated: ${data.planName}`;
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
        <h2>Plan activated 🎟️</h2>
        <p>Hi ${data.name},</p>
        <p>Your <strong>${data.planName}</strong> plan for <strong>${data.organizationName}</strong> is now active.</p>
        <table style="border-collapse: collapse; margin: 12px 0;">
          <tr><td style="padding: 4px 12px; color: #6b7280;">Price</td><td style="padding: 4px 12px; font-weight: 600;">$${data.pricePaid}</td></tr>
          <tr><td style="padding: 4px 12px; color: #6b7280;">Validity</td><td style="padding: 4px 12px; font-weight: 600;">${data.validityInDays} days</td></tr>
          <tr><td style="padding: 4px 12px; color: #6b7280;">Expires on</td><td style="padding: 4px 12px; font-weight: 600;">${new Date(data.expiryDate).toLocaleDateString()}</td></tr>
        </table>
        <p>You can review or change your plan from <em>Settings → Subscription</em>.</p>
        <p>— The EventSH Team</p>
      </div>`;
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  // ✅ Reminder N days before expiry
  async sendPlanExpiryWarning(data: {
    name: string;
    email: string;
    organizationName: string;
    planName: string;
    daysLeft: number;
    expiryDate: Date;
  }) {
    const subject = `Your ${data.planName} plan expires in ${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"}`;
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
        <h2>Heads up — your plan is ending soon</h2>
        <p>Hi ${data.name},</p>
        <p>Your <strong>${data.planName}</strong> plan for <strong>${data.organizationName}</strong> will expire on
          <strong>${new Date(data.expiryDate).toLocaleDateString()}</strong> — that's
          <strong>${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"}</strong> away.</p>
        <p>After expiry, you'll get a 7-day grace window before premium features are locked. Renew or switch your plan from <em>Settings → Subscription</em> to avoid interruption.</p>
        <p>— The EventSH Team</p>
      </div>`;
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  // ✅ Subscription was cancelled
  async sendSubscriptionCancelled(data: {
    name: string;
    email: string;
    organizationName: string;
    planName?: string | null;
  }) {
    const subject = `Your subscription has been cancelled`;
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; color: #1f2937; line-height: 1.6;">
        <h2>Subscription cancelled</h2>
        <p>Hi ${data.name},</p>
        <p>The <strong>${data.planName || "current"}</strong> plan for <strong>${data.organizationName}</strong> has been cancelled.</p>
        <p>You can re-subscribe to a plan anytime from <em>Settings → Subscription</em>. Premium features will remain available until the end of any active billing period.</p>
        <p>— The EventSH Team</p>
      </div>`;
    await this.transporter.sendMail({
      from: `"EventSH" <${process.env.SMTP_USER}>`,
      to: data.email,
      subject,
      html: body,
    });
  }

  /**
   * Recipient list for organizer-facing emails: when the primary and business
   * emails differ, BOTH addresses receive the message. Identical or empty
   * values are de-duped. Returns a comma-joined string (nodemailer delivers to
   * every listed recipient) or "" when none are valid.
   */
  static recipientList(...emails: (string | undefined | null)[]): string {
    const seen = new Set<string>();
    for (const raw of emails) {
      const v = String(raw || "")
        .trim()
        .toLowerCase();
      if (v) seen.add(v);
    }
    return Array.from(seen).join(", ");
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({
        from: `"EventSH" <${process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
    } catch (err) {
      console.error("Failed to send email:", err);
      throw err;
    }
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    attachments?: {
      filename: string;
      content: string | Buffer;
      encoding?: string;
      cid?: string;
    }[];
    // When passed (an organizer's emailConfig), the message is sent from their
    // custom address/SMTP; otherwise it goes from the global EventSH sender.
    senderConfig?: OrgEmailConfig;
  }) {
    try {
      const { transporter, from } = this.resolveSender(options.senderConfig);
      await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments || [],
      });
    } catch (err) {
      console.error("Failed to send email:", err);
      throw err;
    }
  }

  /**
   * Send status update email for orders
   */
  // Add the text property to your sendMail options in the sendOrderStatusEmail function
  async sendOrderStatusEmail(
    name: string,
    email: string,
    orderId: string,
    accepted: boolean,
    status: string,
    amount: number,
    shopkeeperName: string,
  ) {
    const statusColor = accepted ? "#22c55e" : "#ef4444";
    const subject = accepted
      ? `Order ${orderId} Confirmed`
      : `Order ${orderId} Update`;

    // Plain text version for better deliverability
    const text = `
    Hello ${name},

    Your order status has been updated.

    Order Information:
    - Order ID: ${orderId}
    - Status: ${status}
    - Amount: ₹${amount}
    - Merchant: ${shopkeeperName}

    ${
      accepted
        ? `Great news! Your payment has been confirmed by the merchant. Your order is now being processed.`
        : `Order Rejected: Your payment was not accepted by the merchant.`
    }
    
    Thank you for your order!

    Regards,
    EventSH Team
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Order ${accepted ? "Confirmed" : "Rejected"}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: ${statusColor}; margin: 0;">Order ${accepted ? "Confirmed" : "Rejected"}</h1>
            <p style="color: #666; margin: 10px 0;">Your order status has been updated.</p>
          </div>
          <h2 style="color: #333;">Hello ${name},</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📋 Order Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; font-weight: bold;">Order ID:</td><td style="padding: 8px 0;">${orderId}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Status:</td><td style="padding: 8px 0; color: ${statusColor}; font-weight: bold;">${status}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Amount:</td><td style="padding: 8px 0;">₹${amount}</td></tr>
              <tr><td style="padding: 8px 0; font-weight: bold;">Merchant:</td><td style="padding: 8px 0;">${shopkeeperName}</td></tr>
            </table>
          </div>
          <div style="margin: 30px 0;">
            ${
              accepted
                ? `<p style="color: #22c55e; font-size: 16px;"><strong>Great news!</strong> Your payment has been confirmed by the merchant. Your order is now being processed.</p>
                   <p>We'll keep you updated on the progress. Thank you for your order!</p>`
                : `<p style="color: #ef4444; font-size: 16px;"><strong>Order Rejected</strong> Your payment was not accepted by the merchant.</p>
                   <p>Please contact the merchant for more details or try placing a new order.</p>`
            }
          </div>
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #1976d2;">Need Help?</h4>
            <p style="margin: 0;">Contact the merchant directly for any questions about your order.</p>
            <p style="margin: 5px 0 0 0;"><strong>Merchant:</strong> ${shopkeeperName}</p>
          </div>
          <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 14px;">Thank you for using our platform!</p>
            <p style="color: #888; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>`;

    await this.sendMail({
      to: email,
      subject,
      html,
    });
  }
}
