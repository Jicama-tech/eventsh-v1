import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import * as fs from "fs";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SponsorsService } from "./sponsors.service";
import { CreateSponsorRequestDto } from "./dto/create-sponsor-request.dto";
import { CreateSponsorDto } from "./dto/create-sponsor.dto";
import { UpdateSponsorDto } from "./dto/update-sponsor.dto";
import { UpdateSponsorStatusDto } from "./dto/update-sponsor-status.dto";
import {
  SubmitSponsorPaymentDto,
  VerifySponsorPaymentDto,
} from "./dto/submit-sponsor-payment.dto";

const UPLOAD_DIR = "./uploads/sponsors";

function generateFileName(_req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname);
  cb(null, `${uuidv4()}${ext}`);
}

// Business logos and payment proofs — images, plus PDF for proofs.
const sponsorFileFilter = (_req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml|pdf)$/)) {
    cb(new Error("Only image or PDF files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

const sponsorUpload = (field: string) =>
  FileInterceptor(field, {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: generateFileName,
    }),
    fileFilter: sponsorFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

@Controller("sponsors")
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  // ---------- PUBLIC ----------

  // Tiers on offer for an event — drives the public "Become a sponsor" page.
  @Get("tiers/:eventId")
  async tiers(@Param("eventId") eventId: string) {
    const data = await this.sponsorsService.getTiersForEvent(eventId);
    return { success: true, message: "Sponsor tiers loaded", data };
  }

  // Confirmed sponsors' logos — feeds the eventfront marquee.
  @Get("event/:eventId/confirmed-logos")
  async confirmedLogos(@Param("eventId") eventId: string) {
    const data = await this.sponsorsService.confirmedLogos(eventId);
    return { success: true, message: "Confirmed sponsors fetched", data };
  }

  // An applicant's own application (status + payment step).
  @Get("event/:eventId/my-application/:email")
  async myApplication(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
  ) {
    const data = await this.sponsorsService.getMyApplication(eventId, email);
    return { success: true, message: "Application fetched", data };
  }

  // Apply to sponsor. Multipart — optional `logo` file.
  @Post("apply")
  @UseInterceptors(sponsorUpload("logo"))
  async apply(
    @Body() dto: CreateSponsorRequestDto,
    @UploadedFile() file?: any,
  ) {
    const logo = file ? `/uploads/sponsors/${(file as any).filename}` : undefined;
    const data = await this.sponsorsService.apply(dto, logo);
    return {
      success: true,
      message: "Application submitted. The organizer will review it.",
      data,
    };
  }

  // Sponsor submits transfer details + proof after approval.
  @Post("event/:eventId/my-application/:email/payment")
  @UseInterceptors(sponsorUpload("transactionScreenshot"))
  async submitPayment(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
    @Body() dto: SubmitSponsorPaymentDto,
    @UploadedFile() file?: any,
  ) {
    const screenshot = file
      ? `/uploads/sponsors/${(file as any).filename}`
      : undefined;
    const data = await this.sponsorsService.submitPayment(
      eventId,
      email,
      dto,
      screenshot,
    );
    return { success: true, message: "Payment submitted", data };
  }

  // ---------- ORGANIZER ----------

  @Get("event/:eventId")
  @UseGuards(JwtAuthGuard)
  async listByEvent(@Param("eventId") eventId: string) {
    const { requests, currency } =
      await this.sponsorsService.listByEvent(eventId);
    return {
      success: true,
      message: "Sponsor applications fetched",
      data: requests,
      currency,
    };
  }

  // ---------- ORGANIZER: sponsor CRM (own directory) ----------

  // Multipart so the organizer can attach the company logo while adding.
  @Post("create-by-organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(sponsorUpload("logo"))
  async createForOrganizer(
    @Param("organizerId") organizerId: string,
    @Body() dto: CreateSponsorDto,
    @UploadedFile() file?: any,
  ) {
    const logo = file
      ? `/uploads/sponsors/${(file as any).filename}`
      : undefined;
    const { message, data } = await this.sponsorsService.createForOrganizer(
      organizerId,
      dto,
      logo,
    );
    return { success: true, message, data };
  }

  @Patch("update-by-organizer/:organizerId/:sponsorId")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(sponsorUpload("logo"))
  async updateForOrganizer(
    @Param("organizerId") organizerId: string,
    @Param("sponsorId") sponsorId: string,
    @Body() dto: UpdateSponsorDto,
    @UploadedFile() file?: any,
  ) {
    const logo = file
      ? `/uploads/sponsors/${(file as any).filename}`
      : undefined;
    const { message, data } = await this.sponsorsService.updateForOrganizer(
      organizerId,
      sponsorId,
      dto,
      logo,
    );
    return { success: true, message, data };
  }

  // Which events this directory sponsor has backed (eye icon in the CRM).
  @Get("history/:organizerId/:sponsorId")
  @UseGuards(JwtAuthGuard)
  async sponsorEventHistory(
    @Param("organizerId") organizerId: string,
    @Param("sponsorId") sponsorId: string,
  ) {
    const data = await this.sponsorsService.sponsorEventHistory(
      organizerId,
      sponsorId,
    );
    return { success: true, message: "Sponsor history fetched", data };
  }

  @Get("list-by-organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  async listSponsorsForOrganizer(@Param("organizerId") organizerId: string) {
    const { data, currency } =
      await this.sponsorsService.listSponsorsForOrganizer(organizerId);
    return { success: true, message: "Sponsors fetched", data, currency };
  }

  @Delete("delete-by-organizer/:organizerId/:sponsorId")
  @UseGuards(JwtAuthGuard)
  async deleteForOrganizer(
    @Param("organizerId") organizerId: string,
    @Param("sponsorId") sponsorId: string,
  ) {
    const { message } = await this.sponsorsService.deleteForOrganizer(
      organizerId,
      sponsorId,
    );
    return { success: true, message };
  }

  @Get("organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  async listByOrganizer(@Param("organizerId") organizerId: string) {
    const { requests, currency } =
      await this.sponsorsService.listByOrganizer(organizerId);
    return {
      success: true,
      message: "Sponsor applications fetched",
      data: requests,
      currency,
    };
  }

  @Get("request/:id")
  @UseGuards(JwtAuthGuard)
  async getOne(@Param("id") id: string) {
    const data = await this.sponsorsService.getOne(id);
    return { success: true, message: "Sponsor application fetched", data };
  }

  @Patch("request/:id/status")
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSponsorStatusDto,
  ) {
    const data = await this.sponsorsService.updateStatus(id, dto);
    return { success: true, message: "Status updated", data };
  }

  @Patch("request/:id/verify-payment")
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Param("id") id: string,
    @Body() dto: VerifySponsorPaymentDto,
  ) {
    const data = await this.sponsorsService.verifyPayment(id, dto);
    return { success: true, message: "Payment verified", data };
  }
}
