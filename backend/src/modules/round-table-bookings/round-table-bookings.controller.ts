import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { RoundTableBookingsService } from "./round-table-bookings.service";
import { CreateRoundTableBookingDto } from "./dto/create-round-table-booking.dto";
import { ScanRoundTableQRDto } from "./dto/scan-round-table-qr.dto";
import { AllotRoundTableDto } from "./dto/allot-round-table.dto";

@Controller("round-table-bookings")
export class RoundTableBookingsController {
  constructor(private readonly service: RoundTableBookingsService) {}

  @Post("create")
  async createBooking(@Body() dto: CreateRoundTableBookingDto) {
    return this.service.createBooking(dto);
  }

  @Post("submit-payment")
  async submitPayment(@Body() body: { bookingId: string }) {
    return this.service.submitPayment(body.bookingId);
  }

  @Post("confirm-payment")
  async confirmPayment(@Body() body: { bookingId: string }) {
    return this.service.confirmPayment(body.bookingId);
  }

  // Organizer assigns the table/chairs to an organizer-allotted booking.
  @Post(":id/allot")
  async allot(@Param("id") id: string, @Body() dto: AllotRoundTableDto) {
    return this.service.allot(id, dto);
  }

  // Declared before @Get(":id") so "check-request" isn't read as an id.
  @Get("check-request/:eventId/:email")
  async checkExistingBookings(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
  ) {
    return this.service.checkExistingBookings(eventId, email);
  }

  @Get("available/:eventId")
  async getAvailableRoundTables(@Param("eventId") eventId: string) {
    return this.service.getAvailableRoundTables(eventId);
  }

  @Get("event/:eventId")
  async getBookingsByEvent(@Param("eventId") eventId: string) {
    return this.service.getBookingsByEvent(eventId);
  }

  @Get("download-ticket/:id")
  async downloadTicket(@Param("id") id: string, @Res() res: Response) {
    const result = await this.service.downloadTicket(id);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    });
    return res.status(HttpStatus.OK).send(result.buffer);
  }

  @Post("scan-qr")
  async scanQR(@Body() dto: ScanRoundTableQRDto) {
    return this.service.scanQR(dto.qrCodeData);
  }

  @Get(":id")
  async getBookingById(@Param("id") id: string) {
    return this.service.getBookingById(id);
  }
}
