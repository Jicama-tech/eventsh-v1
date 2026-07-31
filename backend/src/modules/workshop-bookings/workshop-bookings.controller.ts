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
import { WorkshopBookingsService } from "./workshop-bookings.service";
import { CreateWorkshopBookingDto } from "./dto/create-workshop-booking.dto";
import { ScanWorkshopQRDto } from "./dto/scan-workshop-qr.dto";

@Controller("workshop-bookings")
export class WorkshopBookingsController {
  constructor(private readonly service: WorkshopBookingsService) {}

  @Post("create")
  async createBooking(@Body() dto: CreateWorkshopBookingDto) {
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

  @Get("available/:eventId")
  async getAvailableWorkshops(@Param("eventId") eventId: string) {
    return this.service.getAvailableWorkshops(eventId);
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
  async scanQR(@Body() dto: ScanWorkshopQRDto) {
    return this.service.scanQR(dto.qrCodeData);
  }

  @Get(":id")
  async getBookingById(@Param("id") id: string) {
    return this.service.getBookingById(id);
  }
}
