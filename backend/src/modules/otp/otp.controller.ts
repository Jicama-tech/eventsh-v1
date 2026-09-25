import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  BadRequestException,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Response } from "express";
import { OtpService } from "./otp.service";
import { CreateOtpDto } from "./dto/create-otp.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminRolesGuard } from "../auth/guards/admin-roles.guard";

@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  // The PLATFORM number's pairing QR (the shared EventSH sender for OTPs and
  // alerts to organizers). Admin only: whoever scans this QR becomes the
  // platform sender and reads every login code — until now the page was
  // open to anyone. Organizers link their OWN numbers from Settings, through
  // /whatsapp/*, never here.
  @Get("whatsapp/qr-image")
  @UseGuards(JwtAuthGuard, AdminRolesGuard)
  async qrImage(@Res() res: Response) {
    if (this.otpService.isWhatsAppConnected()) {
      return res
        .status(200)
        .send(
          "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>✅ WhatsApp is already paired</h2><p>OTPs will deliver normally.</p></body></html>",
        );
    }
    const buf = await this.otpService.getCurrentQRImage();
    if (!buf) {
      return res
        .status(503)
        .send(
          "<html><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>QR not ready yet</h2><p>Waiting for Baileys to generate one. Refresh in a couple of seconds.</p></body></html>",
        );
    }
    const html = `<!doctype html><html><head><meta http-equiv="refresh" content="15"><title>WhatsApp Pair</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:24px;background:#f8f9fb">
        <h2>Scan to link WhatsApp</h2>
        <p style="color:#555">WhatsApp → Settings → Linked Devices → Link a device. Page auto-refreshes every 15s.</p>
        <img src="data:image/png;base64,${buf.toString("base64")}" alt="QR" style="border:8px solid #fff;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.08)" />
      </body></html>`;
    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  }

  @Post()
  create(@Body() createOtpDto: CreateOtpDto) {
    return this.otpService.create(createOtpDto);
  }

  // Business Email OTP (existing)
  @Post("send-business-email-otp")
  @UseGuards(ThrottlerGuard)
  async sendOtp(
    @Body() body: { businessEmail: string; role: string; organizerId?: string },
  ) {
    await this.otpService.sendOtp(body.businessEmail, body.role, body.organizerId);
    return { message: "OTP sent" };
  }

  @Post("verify-business-email-otp")
  async verifyOtp(
    @Body() body: { businessEmail: string; role: string; otp: string },
  ) {
    await this.otpService.verifyOtp(body.businessEmail, body.role, body.otp);
    return { message: "OTP verified" };
  }

  // Platform-number pairing via pairing code (fallback if the QR is
  // inconvenient). Admin only, for the same reason as the QR page.
  // Usage: GET /otp/whatsapp/pair?phone=9198XXXXXXXX
  @Get("whatsapp/pair")
  @UseGuards(JwtAuthGuard, AdminRolesGuard)
  async pair(@Query("phone") phone: string) {
    if (!phone)
      throw new BadRequestException("phone is required (digits, E.164 no +)");
    const digits = phone.replace(/\D/g, "");
    const code = await this.otpService.requestWhatsAppPairingCode(digits);
    return { phone: digits, code };
  }

  // The old unauthenticated POST /otp/whatsapp/send ("quick send test") is
  // gone: it let anyone send any text to any number from the platform
  // number. Organizers test their own number with POST /whatsapp/send.

  // WhatsApp OTP. Throttled: the 30 s per-number cooldown alone let a caller
  // bomb many numbers at once.
  @Post("send-whatsapp-otp")
  @UseGuards(ThrottlerGuard)
  async sendWhatsAppOtp(
    @Body() body: { whatsappNumber: string; role: string },
  ) {
    return this.otpService.sendWhatsAppOtp(body.whatsappNumber, body.role);
  }

  @Post("verify-whatsapp-otp")
  async verifyWhatsAppOtp(
    @Body() body: { whatsappNumber: string; role: string; otp: string },
  ) {
    return this.otpService.verifyWhatsAppOtp(
      body.whatsappNumber,
      body.role,
      body.otp,
    );
  }

  // Email OTP LOGIN (organizer) — email-first replacement for WhatsApp login.
  @Post("send-email-login-otp")
  @UseGuards(ThrottlerGuard)
  async sendEmailLoginOtp(
    @Body() body: { email: string; role: string },
  ) {
    return this.otpService.sendEmailLoginOtp(body.email, body.role);
  }

  @Post("verify-email-login-otp")
  async verifyEmailLoginOtp(
    @Body()
    body: { email: string; role: string; otp: string; shopId?: string },
  ) {
    return this.otpService.verifyEmailLoginOtp(
      body.email,
      body.role,
      body.otp,
      body.shopId,
    );
  }

  @Post("verify-chat-otp")
  async verifyChatOTP(
    @Body()
    body: {
      whatsappNumber: string;
      role: string;
      otp: string;
      shopId?: string;
      emailId?: string;
    },
  ) {
    try {
      return this.otpService.VerifyWhatsAppOtp(
        body.whatsappNumber,
        body.role,
        body.otp,
        body.shopId,
        body.emailId,
      );
    } catch (error) {
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.otpService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.otpService.findOne(+id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.otpService.remove(+id);
  }
}
