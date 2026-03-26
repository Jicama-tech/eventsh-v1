import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import { StallsService } from "./stalls.service";
import { CreateStallDto } from "./dto/create-stall.dto";
import { SelectTablesAndAddOnsDto } from "./dto/tableSelect.dto";
import { UpdatePaymentStatusDto } from "./dto/paymentStatus.dto";
import { UpdateStatusDto } from "./dto/updateStatus.dto";
import { ConfirmPaymentDto } from "./dto/confirm-Payment.dto";
import { ScanQRDto } from "./dto/scan-qr.dto";
import { SendBulkInvitationDto } from "./dto/sendBulkInvitation.dto";
import { diskStorage } from "multer";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

function generateFileName(req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  cb(null, filename);
}

const imageFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
    cb(new Error("Only image files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

@Controller("stalls")
export class StallsController {
  constructor(private readonly stallsService: StallsService) {}

  /**
   * PHASE 1: Create initial stall request
   * POST /stalls/register-for-stall
   */
  @Post("register-for-stall")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "registrationImage", maxCount: 1 },
        { name: "companyLogo", maxCount: 1 },
        { name: "productImage", maxCount: 5 },
      ],
      {
        storage: diskStorage({
          destination: "./uploads/stalls",
          filename: generateFileName,
        }),
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      },
    ),
  )
  async createStallRequest(
    @UploadedFiles()
    files: {
      registrationImage?: Express.Multer.File[];
      companyLogo?: Express.Multer.File[];
      productImage?: Express.Multer.File[];
    },
    @Body() createStallDto: CreateStallDto,
  ) {
    // 1. Handle Registration Image (Single)
    if (files.registrationImage && files.registrationImage[0]) {
      createStallDto.registrationImage = `/uploads/stalls/${files.registrationImage[0].filename}`;
    }

    // 2. Handle Company Logo (Single)
    if (files.companyLogo && files.companyLogo[0]) {
      createStallDto.companyLogo = `/uploads/stalls/${files.companyLogo[0].filename}`;
    }

    // 3. Handle Product Images (Multiple - Array of 5)
    if (files.productImage && files.productImage.length > 0) {
      createStallDto.productImage = files.productImage.map(
        (file) => `/uploads/stalls/${file.filename}`,
      );
    }

    // 4. Call Service
    return await this.stallsService.createStallRequest(createStallDto);
  }

  /**
   * Lookup vendor by WhatsApp number (for returning vendors)
   * GET /stalls/vendor/profile/:whatsAppNumber
   */
  @Get("vendor/profile/:whatsAppNumber")
  async findVendorByWhatsApp(
    @Param("whatsAppNumber") whatsAppNumber: string,
  ) {
    return await this.stallsService.findVendorByWhatsApp(whatsAppNumber);
  }

  /**
   * Lookup vendor by ID
   * GET /stalls/vendor/detail/:vendorId
   */
  @Get("vendor/detail/:vendorId")
  async findVendorDetail(@Param("vendorId") vendorId: string) {
    return await this.stallsService.findVendorById(vendorId);
  }

  /**
   * Check if vendor has existing request for event
   * GET /stalls/check-request/:eventId/:vendorId
   */
  @Get("check-request/:eventId/:vendorId")
  async checkExistingRequest(
    @Param("eventId") eventId: string,
    @Param("vendorId") vendorId: string,
  ) {
    return await this.stallsService.checkExistingRequest(eventId, vendorId);
  }

  /**
   * PHASE 2: Select tables and add-ons
   * PATCH /stalls/:id/select-tables-and-addons
   */
  @Patch(":id/select-tables-and-addons")
  async selectTablesAndAddOns(
    @Param("id") id: string,
    @Body() selectDto: SelectTablesAndAddOnsDto,
  ) {
    return await this.stallsService.selectTablesAndAddOns(id, selectDto);
  }

  /**
   * Get available tables for an event
   * GET /stalls/available-tables/:eventId
   */
  @Get("available-tables/:eventId")
  async getAvailableTables(@Param("eventId") eventId: string) {
    return await this.stallsService.getAvailableTables(eventId);
  }

  /**
   * PHASE 3: Confirm payment and generate QR
   * POST /stalls/confirm-payment
   */
  @Post("confirm-payment")
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Body() confirmPaymentDto: ConfirmPaymentDto) {
    return await this.stallsService.confirmPayment(
      confirmPaymentDto.stallId,
      confirmPaymentDto.notes,
    );
  }

  /**
   * Scan QR code for check-in/check-out
   * POST /stalls/scan-qr
   */
  @Post("scan-qr")
  @HttpCode(HttpStatus.OK)
  async scanQR(@Body() scanQRDto: ScanQRDto) {
    return await this.stallsService.scanStallQR(scanQRDto.qrCodeData);
  }

  /**
   * Get stall attendance details
   * GET /stalls/:id/attendance
   */
  @Get(":id/attendance")
  async getAttendance(@Param("id") id: string) {
    return await this.stallsService.getStallAttendance(id);
  }

  /**
   * Update payment status
   * PATCH /stalls/:id/payment-status
   */
  @Patch(":id/payment-status")
  async updatePaymentStatus(
    @Param("id") id: string,
    @Body() updateDto: UpdatePaymentStatusDto,
  ) {
    return await this.stallsService.updatePaymentStatus(id, updateDto);
  }

  /**
   * Update stall status (used by organizer)
   * PATCH /stalls/:id/status
   */
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() updateDto: UpdateStatusDto,
  ) {
    return await this.stallsService.updateStatus(id, updateDto);
  }

  /**
   * Get all stalls with populated references
   * GET /stalls
   */
  @Get()
  async findAll() {
    return await this.stallsService.findAll();
  }

  /**
   * Get stalls by event ID
   * GET /stalls/event/:eventId
   */
  @Get("event/:eventId")
  async findByEvent(@Param("eventId") eventId: string) {
    return await this.stallsService.findByEventId(eventId);
  }

  @Get("download-stall-ticket/:id")
  async downloadTicket(@Param("id") id: string, @Res() res: Response) {
    const { buffer, filename } =
      await this.stallsService.downloadStallTicket(id);

    // Set headers so the browser knows it's a PDF and downloads it
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    });

    // Send the buffer to the client
    res.end(buffer);
  }

  /**
   * Get stalls by organizer ID
   * GET /stalls/organizer/:organizerId
   */
  @Get("organizer/:organizerId")
  async findByOrganizer(@Param("organizerId") organizerId: string) {
    return await this.stallsService.findByOrganizerId(organizerId);
  }

  /**
   * Get stalls by vendor ID
   * GET /stalls/vendor/:vendorId
   */
  @Get("vendor/:vendorId")
  async findByVendor(@Param("vendorId") vendorId: string) {
    return await this.stallsService.findByShopkeeperId(vendorId);
  }

  /**
   * Get single stall by ID
   * GET /stalls/:id
   */
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return await this.stallsService.findOne(id);
  }

  /**
   * Delete stall registration
   * DELETE /stalls/:id
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    return await this.stallsService.remove(id);
  }

  /**
   * Send bulk invitations to vendors
   * POST /stalls/send-bulk-invitations
   */
  @Post("send-bulk-invitations")
  @HttpCode(HttpStatus.OK)
  async sendBulkInvitations(@Body() bulkInvitationDto: SendBulkInvitationDto) {
    // Implement in service
    return {
      success: true,
      message: "Bulk invitations implementation",
    };
  }

  @Patch(":id/return-deposit")
  @HttpCode(HttpStatus.OK)
  async returnDeposit(@Param("id") id: string, @Body("notes") notes: string) {
    return await this.stallsService.returnedDeposit(id, notes);
  }
}
