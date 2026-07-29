import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { TicketsService } from "./tickets.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { Response } from "express";
import * as fs from "fs";

@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post("create-ticket")
  create(@Body() createTicketDto: CreateTicketDto) {
    return this.ticketsService.create(createTicketDto);
  }

  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get("customer/:email")
  getCustomerTickets(@Param("email") email: string) {
    return this.ticketsService.getCustomerTickets(email);
  }

  @Get("organizer/:organizerId")
  getOrganizerTickets(@Param("organizerId") organizerId: string) {
    return this.ticketsService.getOrganizerTickets(organizerId);
  }

  @Get("event/:eventId")
  getEventTickets(@Param("eventId") eventId: string) {
    return this.ticketsService.getEventTickets(eventId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.ticketsService.findOne(id);
  }

  @Get("by-ticket-id/:ticketId")
  findByTicketId(@Param("ticketId") ticketId: string) {
    return this.ticketsService.findByTicketId(ticketId);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() updateTicketDto: UpdateTicketDto) {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @Patch("use/:ticketId")
  markAsUsed(@Param("ticketId") ticketId: string) {
    return this.ticketsService.markTicketAsUsed(ticketId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.ticketsService.remove(id);
  }

  @Patch("mark-attendance/:ticketId")
  async markAttendance(@Param("ticketId") ticketId: string) {
    try {
      return await this.ticketsService.markAttendance(ticketId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Re-send a visitor's ticket email (the one generated at payment time).
   * Accepts the mongo _id or the human ticketId. An optional `email` in the
   * body corrects a mistyped address and is saved back onto the ticket.
   */
  @Post(":id/resend-email")
  // Guarded, unlike the rest of this controller. Re-sending mails the ticket
  // PDF *and its QR* — the entry credential — and an `email` override also
  // rewrites the address on the booking. Unauthenticated, anyone who learned a
  // ticket id could redirect someone else's ticket to their own inbox.
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  async resendTicketEmail(
    @Param("id") id: string,
    @Body() body?: { email?: string },
  ) {
    return await this.ticketsService.resendTicketEmail(id, body?.email);
  }
}
