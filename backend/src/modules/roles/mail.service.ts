import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { decryptSecret } from "../../common/secret-crypto.util";
import { emailBrand } from "../../common/email/email-brand";
import {
  BRANDED_EMAIL_MARKER,
  brandedEmail,
  button,
  code,
  details,
  escapeEmailHtml,
  heading,
  link,
  note,
  p,
  small,
  strong,
  subheading,
} from "../../common/email/email-layout";

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
  // back to the platform sender (in this instance's brand) when no custom
  // config is active.
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
    return { transporter: this.transporter, from: this.platformFrom() };
  }

  /**
   * The platform sender's From line, named for this instance's brand
   * (EMAIL_BRAND, see common/email/email-brand.ts) — "EventSH" on eventsh.com,
   * "SingAdvisor" on SingAdvisor's instance. `role` qualifies it for the odd
   * message that has always carried one, e.g. "Security".
   */
  private platformFrom(role?: string): string {
    const name = `${emailBrand().senderName}${role ? ` ${role}` : ""}`.replace(/"/g, "");
    // Same fallback as the transporter's auth user in the constructor: the
    // address must be the account actually sending, or it is "<undefined>".
    const address = process.env.SMTP_USER || "attendancemanagement2025@gmail.com";
    return `"${name}" <${address}>`;
  }

  /**
   * Every send in this service goes through here, for two guarantees no single
   * template can forget:
   *
   * - The brand frame and its "do not reply" footer. A template built with
   *   brandedEmail() passes straight through; anything else (a new template
   *   written the old way, a caller's raw fragment) is framed here and logged,
   *   so it still reaches the reader in the instance's brand rather than bare
   *   — or, on a white-label instance, in nobody's brand at all.
   * - Headers saying the message is automated: RFC 3834's Auto-Submitted, so
   *   well-behaved vacation responders and ticketing systems do not answer it,
   *   and Exchange's equivalent for out-of-office and auto-replies. Bounces
   *   are deliberately NOT suppressed — they are how a dead address surfaces.
   */
  private deliver(
    transporter: nodemailer.Transporter,
    mail: nodemailer.SendMailOptions,
  ) {
    return transporter.sendMail({
      ...mail,
      html: typeof mail.html === "string" ? this.frame(mail.html, mail.subject) : mail.html,
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        ...(mail.headers as Record<string, string> | undefined),
      },
    });
  }

  /** The safety net described on deliver(). Public so a caller that builds a
   * message for another channel can reuse the exact same framing. */
  frame(html: string, subject?: string): string {
    if (html.includes(BRANDED_EMAIL_MARKER)) return html;
    console.warn(
      `Email "${subject ?? ""}" was not built with brandedEmail() — framing it in the ${emailBrand().name} template.`,
    );
    // A full document keeps only what is inside its <body>; its own <head>
    // styles would be stripped by most clients anyway.
    const inner = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
    return brandedEmail({ body: inner });
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
    await this.deliver(transporter, {
      from,
      to,
      subject: `${emailBrand().name} — test email from your address`,
      html: brandedEmail({
        preheading: "Test email",
        preview: "Your mail server is set up correctly.",
        body:
          heading("It works! ✅") +
          p(`This is a test email sent from ${strong(from)} using your own mail server.`) +
          p("All emails for your events will now be sent from this address."),
      }),
    });
  }

  // ✉️ Send to Admin when a new role application is submitted
  async sendApprovalRequestToAdmin(data: {
    name: string;
    email: string;
    role: string;
  }) {
    await this.deliver(this.transporter, {
      from: this.platformFrom(),
      to: process.env.ADMIN_EMAIL || "admin@eventsh.com",
      subject: `Approval Request for New ${data.role}`,
      html: brandedEmail({
        preheading: "Approval request",
        preview: `${data.name} has applied for the role of ${data.role}.`,
        body:
          heading("Approval Needed") +
          p(
            `User ${strong(data.name)} (${escapeEmailHtml(data.email)}) has applied for the role of ${strong(data.role)}.`,
          ) +
          p("Please log in to the admin dashboard to approve or reject this request."),
      }),
    });
  }

  // ✉️ Send to applicant confirming their request is pending
  async sendConfirmationToUser(data: {
    name: string;
    email: string;
    role: string;
  }) {
    await this.deliver(this.transporter, {
      from: this.platformFrom(),
      to: data.email,
      subject: `Your ${data.role} Registration is Pending`,
      html: brandedEmail({
        preheading: "Registration pending",
        preview: "Your request has been sent to the admin team for approval.",
        body:
          heading(`Hello ${data.name},`) +
          p(`Thank you for applying to become a ${escapeEmailHtml(data.role)} on our platform.`) +
          p(
            "Your request has been sent to the admin team for approval. You will receive an email once it's approved.",
          ),
      }),
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

    const brand = emailBrand();
    const enquiryLabel = enquiryLabelMap[data.enquiryFor] ?? `${brand.name} Services`;

    await this.deliver(this.transporter, {
      from: this.platformFrom(),
      to: data.emailId,
      subject: `We’ve received your enquiry for ${enquiryLabel}`,
      html: brandedEmail({
        preheading: "Enquiry received",
        preview: `Your enquiry for ${enquiryLabel} has been received.`,
        body:
          heading(`Hi ${data.firstName},`) +
          p(
            `Thank you for reaching out to ${strong(brand.name)} from ${strong(data.organizationName)}.`,
          ) +
          p(`Your enquiry for ${strong(enquiryLabel)} has been received successfully.`) +
          p(
            "Our team will review your requirements and get back to you as soon as possible with the next steps.",
          ) +
          p(
            `If you need to share any additional details, you can send them through our ${link("contact page", brand.contactUrl)}.`,
          ),
      }),
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
        body = brandedEmail({
          preheading: "Registration approved",
          preview: `Your application for the role of ${data.role} has been approved.`,
          body:
            heading(`Congratulations ${data.name}!`) +
            p(
              `We are pleased to inform you that your application for the role of ${strong(data.role)} has been <span style="color:#047857;font-weight:bold;">Approved</span>.`,
            ),
        });
      }
    } else if (data.status === "Rejected") {
      if (data.role === "Organizer") {
        subject = `Your ${data.role} Registration is Rejected`;
        body = brandedEmail({
          preheading: "Registration update",
          preview: `An update on your application for the role of ${data.role}.`,
          body:
            heading(`Hello ${data.name},`) +
            p(
              `We regret to inform you that your application for the role of ${strong(data.role)} has been <span style="color:#b91c1c;font-weight:bold;">Rejected</span>.`,
            ) +
            p(
              `If you believe this is a mistake or would like to appeal, please ${link("contact our support team", emailBrand().contactUrl)}.`,
            ),
        });
      }
    }

    await this.deliver(this.transporter, {
      from: this.platformFrom(),
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
    const brand = emailBrand();
    const subject = `Welcome to ${brand.name} - Your Admin Account`;
    // The admin console's sign-in page (frontend route /admin-login).
    const adminLoginUrl = `${process.env.FRONTEND_BASE_URL || brand.siteUrl}/admin-login`;

    const body = brandedEmail({
      preheading: "Admin account",
      preview: `You have been added as an Admin on ${brand.name}.`,
      body:
        heading(`Welcome, ${data.name}!`) +
        p(
          `You have been added as an ${strong("Admin")} on the ${strong(brand.name)} platform by ${strong(data.createdBy)}.`,
        ) +
        subheading("Your Login Credentials:") +
        details([
          ["Email", escapeEmailHtml(data.email)],
          ["Temporary Password", escapeEmailHtml(data.password)],
        ]) +
        note(
          `<strong>Note:</strong> Please log in immediately and change your password from your profile settings.`,
          "warning",
        ) +
        p("Access the Admin Dashboard here:") +
        button("Login Now", adminLoginUrl),
    });

    await this.deliver(this.transporter, {
      from: this.platformFrom(),
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
    await this.deliver(transporter, {
      from,
      to: businessEmail,
      subject: "Your OTP Code for Business Email Verification",
      html: brandedEmail({
        preheading: "Email verification",
        preview: "Use this code to verify your business email address.",
        signOff: false,
        body:
          heading("Your OTP Code") +
          p("Use the following OTP to verify your business email address:") +
          code(otp) +
          p("This code will expire in 10 minutes."),
      }),
    });
  }

  async sendOTPEmail(data: {
    name: string;
    email: string;
    otp: string;
    businessName: string;
  }) {
    const brand = emailBrand();
    // A configured support inbox answers the footer's "if you need help"; with
    // none set, the footer's default (the brand's contact page) stands.
    const supportEmail = process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL;
    await this.deliver(this.transporter, {
      from: this.platformFrom("Security"),
      to: data.email,
      subject: `Your ${brand.name} Login Verification Code - ${data.otp}`,
      html: brandedEmail({
        preheading: "Secure login verification",
        preview: "Your login verification code expires in 10 minutes.",
        signOff: false,
        contact: supportEmail
          ? { label: `contact us at ${supportEmail}`, href: `mailto:${supportEmail}` }
          : undefined,
        body:
          heading(`Hello ${data.name},`) +
          details([
            ["Business", escapeEmailHtml(data.businessName)],
            ["Account", escapeEmailHtml(data.email)],
            ["Requested", escapeEmailHtml(new Date().toLocaleString())],
          ]) +
          p(
            `We received a request to access your ${escapeEmailHtml(brand.name)} Dashboard. Please use the verification code below to complete your login:`,
          ) +
          small("Your verification code") +
          code(data.otp) +
          p(`<strong style="color:#dc2626;">⏰ Expires in 10 minutes</strong>`) +
          subheading("How to use this code:") +
          p(`${strong("Step 1:")} Return to the ${escapeEmailHtml(brand.name)} login page`) +
          p(`${strong("Step 2:")} Enter the 6-digit code above`) +
          p(`${strong("Step 3:")} Click "Verify &amp; Login" to access your dashboard`) +
          note(
            `<strong>🔒 Security Information</strong>` +
              `<ul style="margin:8px 0 0 22px;padding:0;">` +
              `<li>This code is valid for <strong>10 minutes only</strong></li>` +
              `<li>Maximum <strong>3 attempts</strong> allowed</li>` +
              `<li>Never share this code with anyone</li>` +
              `<li>${escapeEmailHtml(brand.name)} will never ask for your OTP via phone or chat</li>` +
              `</ul>`,
            "success",
          ) +
          note(
            `<strong>⚠️ Didn't request this?</strong><br />If you didn't request this login code, someone may be trying to access your account. Please change your password immediately and contact our support team.`,
            "warning",
          ) +
          p(
            "If you're having trouble logging in, you can request a new verification code or contact our support team for assistance.",
          ) +
          button("Contact Support", brand.contactUrl),
      }),
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
    const brand = emailBrand();
    const subject = `Welcome to ${brand.name}, ${data.organizationName}!`;
    const planLine =
      data.planName && data.validityInDays
        ? p(
            `You've been auto-assigned the ${strong(data.planName)} plan (valid for ${data.validityInDays} days). You can upgrade anytime from <em>Settings → Subscription</em>.`,
          )
        : p("You can browse plans anytime from <em>Settings → Subscription</em>.");
    const loginUrl = `${process.env.FRONTEND_BASE_URL || brand.siteUrl}/login`;
    const body = brandedEmail({
      preheading: "Welcome aboard",
      preview: `Your organizer account for ${data.organizationName} is live.`,
      body:
        heading(`Welcome aboard, ${data.name}! 🎉`) +
        p(`Your organizer account for ${strong(data.organizationName)} is live and active.`) +
        planLine +
        p(`Log in via WhatsApp OTP at ${link(loginUrl, loginUrl)} to start creating events.`),
    });
    await this.deliver(this.transporter, {
      from: this.platformFrom(),
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
   * the shared platform sender.
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
    const esc = escapeEmailHtml;

    const subject = `Sponsorship invoice ${data.invoiceNumber} — ${data.eventTitle}`;
    const body = brandedEmail({
      preheading: "Sponsorship invoice",
      preview: `Invoice ${data.invoiceNumber} for your sponsorship of ${data.eventTitle}.`,
      organizer: data.organizationName,
      contact: data.organizerEmail
        ? { label: `write to ${data.organizerEmail}`, href: `mailto:${data.organizerEmail}` }
        : undefined,
      body:
        heading("Sponsorship confirmed 🤝") +
        small(`Invoice ${esc(data.invoiceNumber)}`) +
        p(`Hi ${esc(data.contactName || data.companyName)},`) +
        p(
          `Thank you for sponsoring ${strong(data.eventTitle)}. ${esc(issuer)} has verified your payment and your sponsorship is now confirmed.`,
        ) +
        details([
          ["Sponsor", esc(data.companyName)],
          ["Package", esc(data.tierName)],
          ["Amount paid", esc(money)],
          ["Transaction ref", data.transactionId ? esc(data.transactionId) : ""],
          ["Paid on", data.paidOn ? esc(new Date(data.paidOn).toLocaleDateString()) : ""],
          ["Event date", data.eventDate ? esc(new Date(data.eventDate).toLocaleDateString()) : ""],
          ["Invoice no.", esc(data.invoiceNumber)],
        ]) +
        p(
          `Keep this email as your receipt.${
            data.organizerEmail
              ? ` Any questions, write to ${link(data.organizerEmail, `mailto:${data.organizerEmail}`)}.`
              : ""
          }`,
        ),
    });

    // Both addresses on one send — the sponsor's sign-in Gmail and their
    // company/accounts address — so finance and the contact both get it.
    const recipients = (Array.isArray(data.to) ? data.to : [data.to])
      .map((e) => (e || "").trim().toLowerCase())
      .filter(Boolean);
    const to = [...new Set(recipients)].join(", ");

    await this.deliver(transporter, {
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
   * organizer's own SMTP when configured, otherwise the shared platform sender.
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
    // Values arrive as plain text; an empty one still shows its row, as "—".
    const row = ([label, value]: [string, string]): [string, string] => [
      label,
      escapeEmailHtml(value || "—"),
    ];

    const subject = `${data.heading} — ${data.eventTitle}`;
    const html = brandedEmail({
      preheading: "Supplier update",
      preview: data.summary,
      organizer: data.organizationName,
      body:
        heading(data.heading) +
        p(escapeEmailHtml(data.summary)) +
        details([
          row(["Supplier", data.supplierName]),
          row(["Event", data.eventTitle]),
          row(["Status", data.status]),
          ...(data.rows || []).map(row),
        ]) +
        (data.note ? note(`<strong>Note:</strong> ${escapeEmailHtml(data.note)}`) : "") +
        (data.ctaUrl ? button(data.ctaLabel || "Open", data.ctaUrl) : ""),
    });

    await this.deliver(transporter, {
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
    const body = brandedEmail({
      preheading: "Plan activated",
      preview: `Your ${data.planName} plan for ${data.organizationName} is now active.`,
      body:
        heading("Plan activated 🎟️") +
        p(`Hi ${escapeEmailHtml(data.name)},`) +
        p(
          `Your ${strong(data.planName)} plan for ${strong(data.organizationName)} is now active.`,
        ) +
        details([
          ["Price", escapeEmailHtml(`$${data.pricePaid}`)],
          ["Validity", `${escapeEmailHtml(data.validityInDays)} days`],
          ["Expires on", escapeEmailHtml(new Date(data.expiryDate).toLocaleDateString())],
        ]) +
        p("You can review or change your plan from <em>Settings → Subscription</em>."),
    });
    await this.deliver(this.transporter, {
      from: this.platformFrom(),
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
    const body = brandedEmail({
      preheading: "Plan expiring soon",
      preview: `Your ${data.planName} plan expires on ${new Date(data.expiryDate).toLocaleDateString()}.`,
      body:
        heading("Heads up — your plan is ending soon") +
        p(`Hi ${escapeEmailHtml(data.name)},`) +
        p(
          `Your ${strong(data.planName)} plan for ${strong(data.organizationName)} will expire on ${strong(
            new Date(data.expiryDate).toLocaleDateString(),
          )} — that's ${strong(`${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"}`)} away.`,
        ) +
        p(
          "After expiry, you'll get a 7-day grace window before premium features are locked. Renew or switch your plan from <em>Settings → Subscription</em> to avoid interruption.",
        ),
    });
    await this.deliver(this.transporter, {
      from: this.platformFrom(),
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
    const body = brandedEmail({
      preheading: "Subscription cancelled",
      preview: `The subscription for ${data.organizationName} has been cancelled.`,
      body:
        heading("Subscription cancelled") +
        p(`Hi ${escapeEmailHtml(data.name)},`) +
        p(
          `The ${strong(data.planName || "current")} plan for ${strong(data.organizationName)} has been cancelled.`,
        ) +
        p(
          "You can re-subscribe to a plan anytime from <em>Settings → Subscription</em>. Premium features will remain available until the end of any active billing period.",
        ),
    });
    await this.deliver(this.transporter, {
      from: this.platformFrom(),
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
      await this.deliver(this.transporter, {
        from: this.platformFrom(),
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
    // custom address/SMTP; otherwise it goes from the global platform sender.
    senderConfig?: OrgEmailConfig;
  }) {
    try {
      const { transporter, from } = this.resolveSender(options.senderConfig);
      await this.deliver(transporter, {
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
    ${emailBrand().name} Team
    `;

    const html = brandedEmail({
      preheading: "Order update",
      preview: "Your order status has been updated.",
      body:
        heading(`Order ${accepted ? "Confirmed" : "Rejected"}`) +
        p("Your order status has been updated.") +
        p(`Hello ${escapeEmailHtml(name)},`) +
        subheading("📋 Order Information") +
        details([
          ["Order ID", escapeEmailHtml(orderId)],
          ["Status", `<span style="color:${statusColor};font-weight:bold;">${escapeEmailHtml(status)}</span>`],
          ["Amount", escapeEmailHtml(`₹${amount}`)],
          ["Merchant", escapeEmailHtml(shopkeeperName)],
        ]) +
        (accepted
          ? note(
              `<strong>Great news!</strong> Your payment has been confirmed by the merchant. Your order is now being processed.`,
              "success",
            ) + p("We'll keep you updated on the progress. Thank you for your order!")
          : note(`<strong>Order Rejected</strong> Your payment was not accepted by the merchant.`, "danger") +
            p("Please contact the merchant for more details or try placing a new order.")) +
        note(
          `<strong>Need Help?</strong><br />Contact the merchant directly for any questions about your order.<br /><strong>Merchant:</strong> ${escapeEmailHtml(
            shopkeeperName,
          )}`,
        ) +
        p("Thank you for using our platform!"),
    });

    await this.sendMail({
      to: email,
      subject,
      html,
    });
  }
}
