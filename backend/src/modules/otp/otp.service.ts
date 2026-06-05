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
  // Latest QR string from Baileys connection.update — exposed via /otp/whatsapp/qr-image
  private currentQR: string | null = null;

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<Otp>,
    @InjectModel("Agent") private agentModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private mailService: MailService,
    private readonly organizerService: OrganizersService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
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
          this.logger.log("WhatsApp connected.");
          this.currentQR = null;
          this.reconnecting = false;
        }

        if (connection === "close") {
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
  private get whatsAppOtpEnabled() {
    return process.env.WHATSAPP_OTP_ENABLED !== "false";
  }

  // Low-level send — used by both messaging and OTP. Not gated; callers decide.
  private async rawSendText(whatsappNumber: string, text: string) {
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

  async sendWhatsAppMessage(whatsappNumber: string, text: string) {
    if (!this.whatsAppEnabled) {
      this.logger.log("WhatsApp messaging disabled — skipping text message.");
      return;
    }
    await this.rawSendText(whatsappNumber, text);
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
      `EventSh Verification`;

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
    },
  ) {
    // Mirror to email FIRST (independent of WhatsApp connectivity) so the
    // recipient still gets it even when the WhatsApp socket is down.
    if (email?.to) {
      await this.emailDocument(filePath, fileName, caption, email);
    }

    // WhatsApp messaging is being phased out — when disabled, the document
    // was already delivered by email above, so just stop here.
    if (!this.whatsAppEnabled) {
      this.logger.log("WhatsApp messaging disabled — skipping document send.");
      return;
    }

    if (!this.sock) throw new Error("WhatsApp not connected");
    const jid = this.toJid(whatsappNumber);

    // Read the file
    const fileBuffer = await fs.promises.readFile(filePath);

    await this.sock.sendMessage(jid, {
      document: fileBuffer,
      mimetype: "application/pdf",
      fileName: fileName || "ticket.pdf",
      caption: caption || "",
    });
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
    },
  ): Promise<void> {
    if (!email?.to) return;
    try {
      const buffer = await fs.promises.readFile(filePath);
      const heading = email.heading || "Your Eventsh document";
      // Strip WhatsApp's *bold* markers and turn newlines into <br/>.
      const body = (
        email.message ||
        caption ||
        "Please find your document attached."
      )
        .replace(/\*/g, "")
        .replace(/\n/g, "<br/>");
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:20px">${heading}</h1>
          </div>
          <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
            <p>${body}</p>
            <p style="color:#64748b;font-size:12px;margin-top:20px">Your document is attached to this email as a PDF.</p>
          </div>
        </div>`;
      await this.mailService.sendEmail({
        to: email.to,
        subject:
          email.subject ||
          (caption ? caption.replace(/\*/g, "") : "Your Eventsh document"),
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
