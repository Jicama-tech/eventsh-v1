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
} from "@nestjs/common";
import { Response } from "express";
import { OtpService } from "./otp.service";
import { CreateOtpDto } from "./dto/create-otp.dto";

@Controller("otp")
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  // Open in a browser to scan the WhatsApp pairing QR.
  @Get("whatsapp/qr-image")
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
  async sendOtp(@Body() body: { businessEmail: string; role: string }) {
    await this.otpService.sendOtp(body.businessEmail, body.role);
    return { message: "OTP sent" };
  }

  @Post("verify-business-email-otp")
  async verifyOtp(
    @Body() body: { businessEmail: string; role: string; otp: string },
  ) {
    await this.otpService.verifyOtp(body.businessEmail, body.role, body.otp);
    return { message: "OTP verified" };
  }

  // WhatsApp pairing via pairing code (fallback if terminal QR is inconvenient)
  // Usage: GET /otp/whatsapp/pair?phone=9198XXXXXXXX
  @Get("whatsapp/pair")
  async pair(@Query("phone") phone: string) {
    if (!phone)
      throw new BadRequestException("phone is required (digits, E.164 no +)");
    const digits = phone.replace(/\D/g, "");
    const code = await this.otpService.requestWhatsAppPairingCode(digits);
    return { phone: digits, code };
  }

  // WhatsApp quick send test
  // Usage: POST /otp/whatsapp/send { to: "+9198...", text: "Hello" }
  @Post("whatsapp/send")
  async sendWhatsApp(@Body() body: { to: string; text: string }) {
    if (!body?.to || !body?.text)
      throw new BadRequestException("to and text are required");
    await this.otpService.sendWhatsAppMessage(body.to, body.text);
    return { sent: true };
  }

  // WhatsApp OTP
  @Post("send-whatsapp-otp")
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
