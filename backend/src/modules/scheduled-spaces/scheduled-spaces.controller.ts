import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { ScheduledSpacesService } from "./scheduled-spaces.service";
import { RegisterScheduledSpaceDto } from "./dto/register.dto";
import { SelectSlotsDto } from "./dto/select-slots.dto";
import { ConfirmScheduledSpacePaymentDto } from "./dto/confirm-payment.dto";
import { UpdateScheduledSpaceStatusDto } from "./dto/update-status.dto";
import { ScanScheduledSpaceQRDto } from "./dto/scan-qr.dto";
import { AddScheduledSpaceNoteDto } from "./dto/add-note.dto";

function generateFileName(req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname);
  cb(null, `${uuidv4()}${ext}`);
}

const imageFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
    cb(new Error("Only image files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

@Controller("scheduled-spaces")
export class ScheduledSpacesController {
  constructor(private readonly scheduledSpacesService: ScheduledSpacesService) {}

  @Post("register")
  async register(@Body() dto: RegisterScheduledSpaceDto) {
    return await this.scheduledSpacesService.register(dto);
  }

  // Visitor-side payment proof upload — same shape as stalls' equivalent
  // endpoint. Called right after select-slots when the visitor attaches a
  // screenshot; transactionId can also be (re)sent here.
  @Post("upload-transaction-screenshot")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor("screenshot", {
      storage: diskStorage({
        destination: "./uploads/scheduled-spaces",
        filename: generateFileName,
      }),
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadTransactionScreenshot(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { requestId: string; transactionId?: string },
  ) {
    const screenshotPath = file
      ? `/uploads/scheduled-spaces/${(file as any).filename}`
      : undefined;
    return await this.scheduledSpacesService.updateTransactionDetails(
      body.requestId,
      body.transactionId,
      screenshotPath,
    );
  }

  @Post(":id/notes")
  @HttpCode(HttpStatus.OK)
  async addNote(@Param("id") id: string, @Body() dto: AddScheduledSpaceNoteDto) {
    return await this.scheduledSpacesService.addNote(id, dto.note, dto.addedBy);
  }

  @Get("check-request/:eventId/:email")
  async checkExistingRequest(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
  ) {
    return await this.scheduledSpacesService.checkExistingRequest(
      eventId,
      email,
    );
  }

  @Get("available/:eventId")
  async getAvailableSpaces(
    @Param("eventId") eventId: string,
    @Query("referralCode") referralCode?: unknown,
  ) {
    // Express's query parser turns a repeated (?referralCode=a&referralCode=b)
    // or bracketed (?referralCode[]=a) param into an array/object, not a
    // string — there's no DTO/ValidationPipe on this query param to coerce
    // it, so guard here rather than let a bad request 500 on `.trim()`.
    const code =
      typeof referralCode === "string"
        ? referralCode
        : Array.isArray(referralCode) && typeof referralCode[0] === "string"
          ? referralCode[0]
          : undefined;
    return await this.scheduledSpacesService.getAvailableSpaces(eventId, code);
  }

  @Patch(":id/select-slots")
  async selectSlots(@Param("id") id: string, @Body() dto: SelectSlotsDto) {
    return await this.scheduledSpacesService.selectSlots(id, dto);
  }

  @Post("confirm-payment")
  async confirmPayment(@Body() dto: ConfirmScheduledSpacePaymentDto) {
    return await this.scheduledSpacesService.confirmPayment(dto);
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateScheduledSpaceStatusDto,
  ) {
    return await this.scheduledSpacesService.updateStatus(id, dto);
  }

  @Post("scan-qr")
  async scanQR(@Body() dto: ScanScheduledSpaceQRDto) {
    return await this.scheduledSpacesService.scanQR(dto.qrCodeData);
  }

  @Post(":id/resend-ticket")
  @HttpCode(HttpStatus.OK)
  async resendTicket(
    @Param("id") id: string,
    @Body() body: { changedBy?: string },
  ) {
    return await this.scheduledSpacesService.resendTicket(id, body?.changedBy);
  }

  // Visitor-facing direct PDF download from the ticket dialog on the event
  // page. Same header shape as Stalls' download-stall-ticket endpoint.
  @Get(":id/download-ticket")
  async downloadTicket(@Param("id") id: string, @Res() res: Response) {
    const { buffer, filename } = await this.scheduledSpacesService.downloadTicket(id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(":id/attendance")
  async getAttendance(@Param("id") id: string) {
    return await this.scheduledSpacesService.getAttendance(id);
  }

  @Get("event/:eventId")
  async findByEventId(@Param("eventId") eventId: string) {
    return await this.scheduledSpacesService.findByEventId(eventId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return await this.scheduledSpacesService.findOne(id);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    return await this.scheduledSpacesService.remove(id);
  }
}
