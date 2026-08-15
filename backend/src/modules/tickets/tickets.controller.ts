import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { TicketsService } from "./tickets.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { OrganizerOrApiKeyGuard } from "../organizers/guards/organizer-or-api-key.guard";
import { Response } from "express";
import * as fs from "fs";

@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Shared by every organizer-admin route below. Unlike Events (organizerId
  // resolved server-side by the guard) or Sponsors (organizerId is a raw URL
  // param, checked directly), these routes identify a ticket by its own
  // id/ticketId — ownership has to be resolved via a lookup first, then
  // compared against the caller. create-ticket/findAll/findOne/
  // findByTicketId/getEventTickets/customer lookup are deliberately left
  // alone: create-ticket is the public buyer-purchase path (must stay
  // unauthenticated — matches eventsh's existing trust model, no different
  // for a Phase-4 client's own backend calling it the same way a buyer's
  // browser would), and the door/QR-scan lookups are public by design (the
  // QR payload itself is the secret, not the lookup endpoint).
  private assertOwnsTicket(req: any, ticket: { organizerId: any }) {
    if (String(ticket.organizerId) !== req.user?.userId) {
      throw new ForbiddenException("Not authorized to manage this ticket");
    }
  }

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
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  getOrganizerTickets(
    @Param("organizerId") organizerId: string,
    @Req() req: any,
  ) {
    if (req.user?.userId !== organizerId) {
      throw new ForbiddenException("Not authorized to view this organizer's tickets");
    }
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
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  async update(
    @Param("id") id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Req() req: any,
  ) {
    this.assertOwnsTicket(req, await this.ticketsService.findOne(id));
    return this.ticketsService.update(id, updateTicketDto);
  }

  @Patch("use/:ticketId")
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  async markAsUsed(@Param("ticketId") ticketId: string, @Req() req: any) {
    this.assertOwnsTicket(req, await this.ticketsService.findByTicketId(ticketId));
    return this.ticketsService.markTicketAsUsed(ticketId);
  }

  @Delete(":id")
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  async remove(@Param("id") id: string, @Req() req: any) {
    this.assertOwnsTicket(req, await this.ticketsService.findOne(id));
    return this.ticketsService.remove(id);
  }

  @Patch("mark-attendance/:ticketId")
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  async markAttendance(@Param("ticketId") ticketId: string, @Req() req: any) {
    try {
      this.assertOwnsTicket(req, await this.ticketsService.findByTicketId(ticketId));
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
  // OrganizerOrApiKeyGuard (was AuthGuard("jwt") only) + an explicit
  // ownership check — the guard alone only proves "some valid caller", not
  // that they own *this* ticket.
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async resendTicketEmail(
    @Param("id") id: string,
    @Req() req: any,
    @Body() body?: { email?: string },
  ) {
    // Accepts either the mongo _id or the human ticketId, same as the
    // service call below — mirrors TicketsService.resendTicketEmail's own
    // lookup so the ownership check resolves the exact same document.
    const ticket = /^[0-9a-fA-F]{24}$/.test(id)
      ? await this.ticketsService.findOne(id)
      : await this.ticketsService.findByTicketId(id);
    this.assertOwnsTicket(req, ticket);
    return await this.ticketsService.resendTicketEmail(id, body?.email);
  }
}
