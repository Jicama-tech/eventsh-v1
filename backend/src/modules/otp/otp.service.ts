import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose/dist";
import { Model } from "mongoose";
import { CreateOtpDto } from "./dto/create-otp.dto";
import { Otp } from "./entities/otp.entity";
import { MailService } from "../roles/mail.service";
import { emailBrand } from "../../common/email/email-brand";
import {
  brandedEmail,
  escapeEmailHtml,
  heading,
  p,
  small,
} from "../../common/email/email-layout";
import { JwtService } from "@nestjs/jwt";

// WhatsApp (Baileys)
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  WASocket,
} from "baileys";
import * as qrcode from "qrcode";
import { OrganizersService } from "../organizers/organizers.service";
import * as fs from "fs";
import { OrganizerWhatsappService } from "../whatsapp/organizer-whatsapp.service";

/**
 * Who a WhatsApp message is sent on behalf of, and from which number.
 *
 * `organizerId` is the organizer whose event, stall or booking the message
 * is about — ALWAYS taken from the stored entity (event.organizer,
 * stall.organizerId, booking.organizerId), never from a request body, since
 * it decides whose phone the message goes out from. With it, the message is
 * sent from that organizer's own linked WhatsApp when they have one
 * (Settings › Profile › WhatsApp); without one, or when they are not
 * connected, it falls back to the platform number exactly as before, and the
 * WHATSAPP_ENABLED kill-switch decides whether that goes out at all.
 *
 * `toOrganizer` marks a message TO the organizer themselves (a new request,
 * a payment submitted). OrganizerWhatsappService routes those so they ring:
 * from the platform number when the organizer's own number is the linked one.
 */
export type WhatsAppRouteOptions = {
  organizerId?: string;
  /** The organizer's country, for numbers stored without a country code. */
  country?: string;
  toOrganizer?: boolean;
  /** Who caused the message, when that is not the recipient (`vendor:<id>`). */
  throttleKey?: string;
  /** The organizer's own signed-in action set it off (an approval, a resend). */
  organizerInitiated?: boolean;
};

@Injectable()
export class OtpService implements OnModuleInit {
  private readonly logger = new Logger(OtpService.name);

  // Email/WhatsApp OTP config
  private OTP_LENGTH = 6;
  private EMAIL_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private WHATSAPP_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private RESEND_COOLDOWN_MS = 30 * 1000; // 30s cooldown
  private MAX_ATTEMPTS = 5;

  // WhatsApp socket
  private sock: WASocket | null = null;
  private reconnecting = false;
  /**
   * True only once Baileys reports connection "open". `this.sock` is a poor
   * proxy for this — it stays truthy through a 401 logged-out session, so
   * anything asking "can we deliver?" got a false yes.
   */
  private waAuthed = false;

  // Latest QR string from Baileys connection.update — exposed via /otp/whatsapp/qr-image
  private currentQR: string | null = null;

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<Otp>,
    @InjectModel("Agent") private agentModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private mailService: MailService,
    private readonly organizerService: OrganizersService,
    private readonly jwtService: JwtService,
    private readonly organizerWhatsapp: OrganizerWhatsappService,
  ) {}

  async onModuleInit() {
    // The platform number rings an organizer whose alerts would otherwise
    // come from their own linked device and land silently in "Message
    // yourself" — see OrganizerWhatsappService.notify(). Registered before
    // the kill-switch check below: `isConnected` answers false while the
    // platform number is off, and the alert then goes from the organizer's
    // own number instead.
    this.organizerWhatsapp.registerPlatformSender({
      isConnected: () => this.whatsAppEnabled && this.waAuthed && !!this.sock,
      send: (phone, text) => this.rawSendText(phone, text),
    });
    // WHATSAPP_ENABLED/WHATSAPP_OTP_ENABLED (see the `whatsAppEnabled`/
    // `whatsAppOtpEnabled` getters below) were originally just kill-switches
    // for OUTBOUND sends on the existing SaaS deployment — connecting still
    // happened regardless, which was fine there (an already-paired session
    // stays alive either way). A fresh white-label deployment has no
    // existing pairing though, and defaults both flags to false — without
    // this guard it would attempt a live QR-pairing flow on every single
    // boot for a feature it isn't using, and lose that attempt on restart
    // since whatsapp_auth isn't a mounted volume unless WhatsApp is
    // actually enabled (see docker-compose.whitelabel.yml). Only skip the
    // connection when BOTH are off — either one still true means some
    // outbound path needs a live session, matching existing behaviour.
    if (!this.whatsAppEnabled && !this.whatsAppOtpEnabled) {
      this.logger.log(
        "WhatsApp fully disabled (WHATSAPP_ENABLED=false, WHATSAPP_OTP_ENABLED=false) — skipping connection.",
      );
      return;
    }
    await this.initWhatsApp();
  }

  // =========================
  // WhatsApp INIT/PAIRING
  // =========================
  private async initWhatsApp() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState("whatsapp_auth");
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Baileys prints minimal QR
        browser: ["NestJS", "Chrome", "1.0"],
        syncFullHistory: false,
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQR = qr;
          this.logger.log(
            "WhatsApp QR refreshed. Open http://localhost:3000/otp/whatsapp/qr-image in your browser to scan it.",
          );
        }

        if (connection === "open") {
          this.waAuthed = true;
          this.logger.log("WhatsApp connected.");
          this.currentQR = null;
          this.reconnecting = false;
        }

        if (connection === "close") {
          this.waAuthed = false;
          const err: any = lastDisconnect?.error;
          const code = err?.output?.statusCode || err?.status || err?.code;
          this.logger.warn(
            `WhatsApp closed. code=${code}. Reconnecting in 1500ms...`,
          );
          if (code !== DisconnectReason.loggedOut) {
            if (!this.reconnecting) {
              this.reconnecting = true;
              setTimeout(async () => {
                await this.initWhatsApp();
                this.reconnecting = false;
              }, 1500);
            }
          } else {
            this.logger.error(
              "WhatsApp logged out. Delete whatsapp_auth folder and restart to pair again.",
            );
          }
        }
      });
    } catch (e) {
      this.logger.error("WhatsApp init error", e);
    }
  }

  private normalizePhone(input: string) {
    return input.replace(/\D/g, "");
  }

  private toJid(whatsappNumber: string) {
    const digits = this.normalizePhone(whatsappNumber);
    return `${digits}@s.whatsapp.net`;
  }

  // Returns the latest QR as a PNG Buffer for browser display, or null if paired.
  async getCurrentQRImage(): Promise<Buffer | null> {
    if (!this.currentQR) return null;
    return qrcode.toBuffer(this.currentQR, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
    });
  }

  isWhatsAppConnected(): boolean {
    return !!(this.sock as any)?.user?.id;
  }

  // Pairing via code (fallback if QR is troublesome)
  // IMPORTANT: Pass E.164 digits without '+' e.g. +91 987... -> 91987...
  async requestWhatsAppPairingCode(phoneDigitsE164NoPlus: string) {
    if (!this.sock) throw new Error("WhatsApp not initialized yet");
    const anySock: any = this.sock as any;
    if (typeof anySock.requestPairingCode !== "function") {
      throw new Error("Baileys version does not support pairing code API");
    }
    const code: string = await anySock.requestPairingCode(
      phoneDigitsE164NoPlus,
    );
    this.logger.log(`Pairing code for ${phoneDigitsE164NoPlus}: ${code}`);
    return code;
  }

  // Kill-switches for outbound WhatsApp (we're moving to email). Set in env:
  //   WHATSAPP_ENABLED=false      -> stop notification/ticket/receipt messages
  //   WHATSAPP_OTP_ENABLED=false  -> stop login OTPs (only after those flows
  //                                  are moved to email/Google sign-in)
  private get whatsAppEnabled() {
    return process.env.WHATSAPP_ENABLED !== "false";
  }
  /**
   * Public read of the outbound kill-switch, and whether a paired session is
   * actually live. Callers that offer WhatsApp as a *choice* need this: the
   * send methods below return quietly when the flag is off, which is right
   * for a best-effort mirror but would let a deliberate "send on WhatsApp"
   * report success while delivering nothing.
   */
  get whatsAppOutboundStatus(): {
    enabled: boolean;
    connected: boolean;
    /** A QR is waiting to be scanned — the device needs re-pairing. */
    needsPairing: boolean;
  } {
    return {
      enabled: this.whatsAppEnabled,
      connected: this.waAuthed,
      needsPairing: !this.waAuthed && !!this.currentQR,
    };
  }
  private get whatsAppOtpEnabled() {
    return process.env.WHATSAPP_OTP_ENABLED !== "false";
  }

  /** Whether this organizer's own linked WhatsApp can send right now. */
  isOrganizerWhatsAppConnected(organizerId?: string | null): boolean {
    return !!organizerId && this.organizerWhatsapp.isConnected(String(organizerId));
  }

  // Low-level send — used by both messaging and OTP. Not gated; callers decide.
  private async rawSendText(whatsappNumber: string, text: string) {
    if (!whatsappNumber || !String(whatsappNumber).replace(/\D/g, "")) {
      throw new BadRequestException("No WhatsApp number to send to.");
    }
    if (!this.sock) {
      throw new BadRequestException(
        "WhatsApp gateway not initialized. Please contact admin.",
      );
    }
    // Baileys exposes the authenticated user under `sock.user`; if it's not
    // set, the QR pairing hasn't completed yet — fail with a clear message
    // instead of letting the deep TypeError bubble up as a 500.
    if (!(this.sock as any).user?.id) {
      throw new BadRequestException(
        "WhatsApp gateway is not paired yet. Please scan the QR in the server terminal and try again.",
      );
    }
    const jid = this.toJid(whatsappNumber);
    await this.sock.sendMessage(jid, { text });
  }

  /**
   * A text message, from the organizer's own linked number when `organizerId`
   * is given and that organizer is connected (see WhatsAppRouteOptions), else
   * from the platform number while WHATSAPP_ENABLED allows it.
   *
   * The organizer route never throws: it returns quietly when the organizer
   * is not connected, the plan lacks the add-on or a ceiling is reached, and
   * the platform path then decides as it always has. Callers keep their
   * existing try/catch around the platform path's own failures.
   */
  async sendWhatsAppMessage(
    whatsappNumber: string,
    text: string,
    opts: WhatsAppRouteOptions = {},
  ) {
    if (!whatsappNumber || !String(text ?? "").trim()) {
      this.logger.log("WhatsApp text skipped (no number or empty text).");
      return;
    }
    if (opts.organizerId) {
      const route = await this.organizerWhatsapp.notifyRoute({
        organizerId: opts.organizerId,
        to: whatsappNumber,
        text,
        country: opts.country,
        toOrganizer: opts.toOrganizer,
        throttleKey: opts.throttleKey,
        organizerInitiated: opts.organizerInitiated,
      });
      if (route) return;
    }
    if (!this.whatsAppEnabled) {
      this.logger.log("WhatsApp messaging disabled — skipping text message.");
      return;
    }
    await this.rawSendText(whatsappNumber, text);
  }

  /**
   * Like sendWhatsAppMessage, but never throws and says whether anything
   * went out — for the notifications that are mirrored beside an email and
   * must not be able to fail it.
   */
  async trySendWhatsAppMessage(
    whatsappNumber: string | null | undefined,
    text: string,
    opts: WhatsAppRouteOptions = {},
  ): Promise<boolean> {
    if (!whatsappNumber) return false;
    try {
      if (opts.organizerId) {
        const route = await this.organizerWhatsapp.notifyRoute({
          organizerId: opts.organizerId,
          to: whatsappNumber,
          text,
          country: opts.country,
          toOrganizer: opts.toOrganizer,
          throttleKey: opts.throttleKey,
          organizerInitiated: opts.organizerInitiated,
        });
        if (route) return true;
      }
      if (!this.whatsAppEnabled || !this.waAuthed) return false;
      await this.rawSendText(whatsappNumber, text);
      return true;
    } catch (e: any) {
      this.logger.warn(`WhatsApp text not sent: ${e?.message || e}`);
      return false;
    }
  }

  // =========================
  // Legacy scaffolding
  // =========================
  create(createOtpDto: CreateOtpDto) {
    return "This action adds a new otp";
  }

  private generateOtp(length = this.OTP_LENGTH) {
    let s = "";
    while (s.length < length) s += Math.floor(Math.random() * 10).toString();
    return s;
  }

  // =========================
  // Business Email OTP (existing)
  // =========================
  // `organizerId` is passed for event-scoped flows (vendor/visitor verifying
  // their email for an organizer's event) so the OTP goes out from the
  // organizer's custom sender when enabled. Platform-level flows (e.g.
  // organizer registration) omit it and keep the global EventSH sender.
  async sendOtp(email: string, role: string, organizerId?: string) {
    if (!email) throw new BadRequestException("Email is required");
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // preserves your original method
    const expiresAt = new Date(Date.now() + this.EMAIL_TTL_MS);

    // Cooldown check
    const identifier = email.trim().toLowerCase();
    const channel = "business_email";
    const existing = await this.otpModel.findOne({ channel, role, identifier });
    if (
      existing?.lastSentAt &&
      Date.now() - new Date(existing.lastSentAt).getTime() <
        this.RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException("Please wait before requesting a new OTP");
    }

    await this.otpModel.findOneAndUpdate(
      { channel, role, identifier },
      {
        // legacy fields kept to not break older data usage
        email,
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: new Date(),
        channel,
        identifier,
        role,
      } as any,
      { upsert: true, new: true },
    );

    let senderConfig: any;
    if (organizerId) {
      try {
        const org = await this.organizerModel
          .findById(organizerId)
          .select("emailConfig")
          .lean();
        senderConfig = (org as any)?.emailConfig;
      } catch {
        // Bad/unknown organizerId — fall back to the global sender.
      }
    }
    await this.mailService.sendOtpEmail(email, otp, senderConfig);
  }

  async verifyOtp(email: string, role: string, otp: string) {
    const identifier = email.trim().toLowerCase();
    const channel = "business_email";
    const record = await this.otpModel.findOne({ channel, role, identifier });
    if (!record || record.otp !== otp || record.expiresAt < new Date()) {
      if (record) {
        if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
          await this.otpModel.deleteOne({ channel, role, identifier });
        } else {
          record.attempts += 1;
          await record.save();
        }
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    await this.otpModel.deleteOne({ channel, role, identifier });
    return true;
  }

  // =========================
  // WhatsApp OTP (new)
  // =========================
  async sendWhatsAppOtp(whatsappNumber: string, role: string) {
    if (!whatsappNumber)
      throw new BadRequestException("WhatsApp number is required");
    const digits = this.normalizePhone(whatsappNumber);
    if (digits.length < 8)
      throw new BadRequestException("Invalid WhatsApp number");

    const identifier = digits;
    const channel = "whatsapp";

    const existing = await this.otpModel.findOne({ channel, role, identifier });
    if (
      existing?.lastSentAt &&
      Date.now() - new Date(existing.lastSentAt).getTime() <
        this.RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException("Please wait before requesting a new OTP");
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.WHATSAPP_TTL_MS);

    await this.otpModel.findOneAndUpdate(
      { channel, role, identifier },
      {
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: new Date(),
        channel,
        identifier,
        role,
      } as any,
      { upsert: true, new: true },
    );

    const text =
      `Your verification code is ${otp}.\n` +
      `It expires in 5 minutes. Do not share it with anyone.\n\n` +
      `${emailBrand().name} Verification`;

    // Separate switch from notifications: fail loudly rather than pretend the
    // OTP was sent, so login flows surface the issue instead of hanging.
    if (!this.whatsAppOtpEnabled) {
      throw new BadRequestException(
        "WhatsApp OTP is disabled. Please sign in with email or Google instead.",
      );
    }
    await this.rawSendText(digits, text);

    return { message: "OTP sent to WhatsApp" };
  }

  async verifyWhatsAppOtp(whatsappNumber: string, role: string, otp: string) {
    try {
      const digits = this.normalizePhone(whatsappNumber);
      const identifier = digits;
      const channel = "whatsapp";


      const record = await this.otpModel.findOne({ channel, role, identifier });
      if (!record || record.expiresAt < new Date() || record.otp !== otp) {
        if (record) {
          if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
            await this.otpModel.deleteOne({ channel, role, identifier });
          } else {
            record.attempts += 1;
            await record.save();
          }
        }
        throw new UnauthorizedException("Invalid or expired OTP");
      }


      if (record) {
        await this.otpModel.deleteOne({ channel, role, identifier });
        return { message: "OTP verified" };
      }
    } catch (error) {
      throw error;
    }
  }

  async VerifyWhatsAppOtp(
    whatsappNumber: string,
    role: string,
    otp: string,
    targetId?: string,
    emailId?: string,
  ) {
    const digits = this.normalizePhone(whatsappNumber);
    const identifier = digits;
    const channel = "whatsapp";

    const record = await this.otpModel.findOne({ channel, role, identifier });

    // 1. Validate OTP
    if (!record || record.expiresAt < new Date() || record.otp !== otp) {
      if (record) {
        if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
          await this.otpModel.deleteOne({ channel, role, identifier });
        } else {
          record.attempts += 1;
          await record.save();
        }
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    let result = null;

    if (role === "organizer") {
      result = await this.organizerService.findByWhatsAppNumber(
        whatsappNumber,
        targetId,
      );
      if (!result) throw new NotFoundException("Organizer not found");

      // Handle multiple organization selection
      if (result.requiresSelection) {
        return {
          message: "Multiple organizations found",
          requiresSelection: true,
          organizations: result.organizations,
        };
      }
    } else if (role === "agent") {
      const digits = whatsappNumber.replace(/\D/g, "");
      const agent = await this.agentModel.findOne({
        whatsAppNumber: { $regex: digits + "$" },
        isActive: true,
      });
      if (!agent) throw new NotFoundException("Agent not found");

      const token = this.jwtService.sign(
        {
          name: agent.name,
          email: agent.email,
          sub: agent._id.toString(),
          roles: ["agent"],
          referralCode: agent.referralCode,
        },
        {
          secret: process.env.JWT_ACCESS_SECRET,
          expiresIn: "24h",
        },
      );
      result = { token };
    } else if (role === "shopkeeper" || role === "vendor" || role === "speaker") {
      // Vendor/stall applicant - just verify OTP, no profile lookup needed
      await this.otpModel.deleteOne({ channel, role, identifier });
      return { message: "OTP verified", data: { whatsappNumber, verified: true } };
    }

    // 4. Success: Delete OTP only after a token is successfully generated
    await this.otpModel.deleteOne({ channel, role, identifier });

    return { message: "OTP verified", data: result?.token };
  }

  // =========================
  // Email OTP LOGIN (organizer) — the email-first replacement for the
  // WhatsApp login flow. sendEmailLoginOtp confirms an account exists for the
  // email before emailing a code; verifyEmailLoginOtp validates the code and
  // returns a JWT (or a requiresSelection payload for multi-org emails).
  // =========================
  async sendEmailLoginOtp(email: string, role: string) {
    if (!email) throw new BadRequestException("Email is required");
    const identifier = email.trim().toLowerCase();
    const channel = "business_email";

    // Only email a code if this address is actually linked to an account,
    // so we don't send login codes to arbitrary addresses.
    if (role === "organizer") {
      const exists = await this.organizerService.findByEmailForLogin(
        identifier,
      );
      if (!exists) {
        throw new NotFoundException(
          "No organizer account is registered with this email.",
        );
      }
    }

    const existing = await this.otpModel.findOne({ channel, role, identifier });
    if (
      existing?.lastSentAt &&
      Date.now() - new Date(existing.lastSentAt).getTime() <
        this.RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException("Please wait before requesting a new OTP");
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.EMAIL_TTL_MS);

    await this.otpModel.findOneAndUpdate(
      { channel, role, identifier },
      {
        email: identifier,
        otp,
        expiresAt,
        attempts: 0,
        verified: false,
        lastSentAt: new Date(),
        channel,
        identifier,
        role,
      } as any,
      { upsert: true, new: true },
    );

    await this.mailService.sendOtpEmail(identifier, otp);
    return { message: "OTP sent to email" };
  }

  async verifyEmailLoginOtp(
    email: string,
    role: string,
    otp: string,
    targetId?: string,
  ) {
    const identifier = email.trim().toLowerCase();
    const channel = "business_email";

    const record = await this.otpModel.findOne({ channel, role, identifier });
    if (!record || record.expiresAt < new Date() || record.otp !== otp) {
      if (record) {
        if (record.attempts + 1 >= this.MAX_ATTEMPTS) {
          await this.otpModel.deleteOne({ channel, role, identifier });
        } else {
          record.attempts += 1;
          await record.save();
        }
      }
      throw new UnauthorizedException("Invalid or expired OTP");
    }

    if (role !== "organizer") {
      await this.otpModel.deleteOne({ channel, role, identifier });
      return { message: "OTP verified", data: { email: identifier } };
    }

    const result = await this.organizerService.findByEmailForLogin(
      identifier,
      targetId,
    );
    if (!result) throw new NotFoundException("Organizer not found");

    if ((result as any).requiresSelection) {
      // Keep the OTP alive so the follow-up selection call can re-validate it.
      return {
        message: "Multiple organizations found",
        requiresSelection: true,
        organizations: (result as any).organizations,
      };
    }

    await this.otpModel.deleteOne({ channel, role, identifier });
    return { message: "OTP verified", data: (result as any).token };
  }

  // =========================
  // Stubs (kept)
  // =========================
  findAll() {
    return `This action returns all otp`;
  }

  findOne(id: number) {
    return `This action returns a #${id} otp`;
  }

  remove(id: number) {
    return `This action removes a #${id} otp`;
  }

  async sendMediaMessage(
    whatsappNumber: string,
    filePath: string,
    caption?: string,
    /** Filename the recipient sees on WhatsApp. Defaults to `ticket.pdf`
     *  for back-compat with the original ticket-send flow; receipts pass
     *  something descriptive like `eventsh-receipt-<ref>.pdf`. */
    fileName?: string,
    /** When provided with a `to` address, the same document is also emailed
     *  to the registered email — so everything we send on WhatsApp also
     *  lands in the recipient's inbox. Best-effort: a mail failure never
     *  affects the WhatsApp delivery. */
    email?: {
      to?: string;
      subject?: string;
      heading?: string;
      message?: string;
      // Organizer's custom-sender config — when present the mirror email is
      // sent from their address instead of the global EventSH sender.
      senderConfig?: any;
      // Name of the organizer the document is sent on behalf of — it heads
      // and signs the mirror email (see brandedEmail's `organizer`).
      organizer?: string;
    },
    /** See WhatsAppRouteOptions: with `organizerId`, the document goes out
     * from that organizer's own linked WhatsApp when they are connected. */
    opts: WhatsAppRouteOptions & { mimetype?: string } = {},
  ) {
    // Mirror to email FIRST (independent of WhatsApp connectivity) so the
    // recipient still gets it even when the WhatsApp socket is down.
    if (email?.to) {
      await this.emailDocument(filePath, fileName, caption, email);
    }

    // No number: the document was already delivered by email above, so stop
    // here (callers can safely pass an empty number to email-only).
    if (!whatsappNumber) {
      this.logger.log("WhatsApp document send skipped (no number) — delivered by email.");
      return;
    }

    let fileBuffer: Buffer | null = null;
    if (opts.organizerId) {
      fileBuffer = await fs.promises.readFile(filePath);
      const sent = await this.organizerWhatsapp.trySendDocumentFromOrganizer(
        opts.organizerId,
        whatsappNumber,
        {
          document: fileBuffer,
          fileName: fileName || "ticket.pdf",
          mimetype: opts.mimetype || "application/pdf",
          caption: caption || undefined,
        },
        opts.country,
        { perRecipientLimit: !opts.organizerInitiated },
      );
      if (sent) return;
    }

    // The platform number, unless the kill-switch says email only.
    if (!this.whatsAppEnabled) {
      this.logger.log(
        "WhatsApp document send skipped (platform WhatsApp disabled) — delivered by email.",
      );
      return;
    }

    if (!this.sock) throw new Error("WhatsApp not connected");
    const jid = this.toJid(whatsappNumber);
    if (!fileBuffer) fileBuffer = await fs.promises.readFile(filePath);

    await this.sock.sendMessage(jid, {
      document: fileBuffer,
      mimetype: opts.mimetype || "application/pdf",
      fileName: fileName || "ticket.pdf",
      caption: caption || "",
    });
  }

  /**
   * sendMediaMessage for a document that only exists in memory (a ticket PDF
   * rendered for an email attachment, a receipt built with pdfkit). Never
   * throws — these are mirrors beside an email that must not be able to fail
   * it — and says whether the file went out on WhatsApp.
   */
  async trySendMediaBuffer(
    whatsappNumber: string | null | undefined,
    document: Buffer,
    fileName: string,
    caption?: string,
    opts: WhatsAppRouteOptions & { mimetype?: string } = {},
  ): Promise<boolean> {
    if (!whatsappNumber || !document?.length) return false;
    try {
      if (opts.organizerId) {
        const sent = await this.organizerWhatsapp.trySendDocumentFromOrganizer(
          opts.organizerId,
          whatsappNumber,
          {
            document,
            fileName: fileName || "document.pdf",
            mimetype: opts.mimetype || "application/pdf",
            caption: caption || undefined,
          },
          opts.country,
          { perRecipientLimit: !opts.organizerInitiated },
        );
        if (sent) return true;
      }
      if (!this.whatsAppEnabled || !this.waAuthed || !this.sock) return false;
      await this.sock.sendMessage(this.toJid(whatsappNumber), {
        document,
        mimetype: opts.mimetype || "application/pdf",
        fileName: fileName || "document.pdf",
        caption: caption || "",
      });
      return true;
    } catch (e: any) {
      this.logger.warn(`WhatsApp document not sent: ${e?.message || e}`);
      return false;
    }
  }

  // Email a document attachment, reusing the WhatsApp caption/message as the
  // body. Swallows its own errors (logged) so callers never have to guard it.
  private async emailDocument(
    filePath: string,
    fileName: string | undefined,
    caption: string | undefined,
    email: {
      to?: string;
      subject?: string;
      heading?: string;
      message?: string;
      senderConfig?: any;
      organizer?: string;
    },
  ): Promise<void> {
    if (!email?.to) return;
    try {
      const buffer = await fs.promises.readFile(filePath);
      const title = email.heading || `Your ${emailBrand().name} document`;
      // Strip WhatsApp's *bold* markers and turn newlines into <br/>. The text
      // is plain (names, event titles), so it is escaped before the <br/>s go in.
      const body = escapeEmailHtml(
        email.message ||
        caption ||
        "Please find your document attached."
      )
        .replace(/\*/g, "")
        .replace(/\n/g, "<br/>");
      const html = brandedEmail({
        preheading: "Document attached",
        preview: title,
        body:
          heading(title) +
          p(body) +
          small("Your document is attached to this email as a PDF."),
        organizer: email.organizer,
      });
      await this.mailService.sendEmail({
        to: email.to,
        subject:
          email.subject ||
          (caption
            ? caption.replace(/\*/g, "")
            : `Your ${emailBrand().name} document`),
        html,
        attachments: [{ filename: fileName || "document.pdf", content: buffer }],
        senderConfig: email.senderConfig,
      });
      this.logger.log(`Document also emailed to ${email.to}`);
    } catch (e: any) {
      this.logger.warn(
        `Email mirror failed for ${email.to}: ${e?.message || e}`,
      );
    }
  }
}
