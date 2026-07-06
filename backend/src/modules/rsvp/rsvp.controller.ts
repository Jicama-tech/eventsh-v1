import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { RsvpService } from "./rsvp.service";
import { CreateRsvpDto } from "./dto/create-rsvp.dto";

@Controller()
export class RsvpController {
  constructor(private readonly rsvpService: RsvpService) {}

  // Public — a guest submits/updates their RSVP. Identity is the
  // Google-verified email the eventfront sends after member sign-in (same
  // trust model as the existing member flow + public feedback endpoint).
  @Post("events/:eventId/rsvp")
  async submit(
    @Param("eventId") eventId: string,
    @Body() dto: CreateRsvpDto,
  ) {
    const data = await this.rsvpService.submit(eventId, dto);
    return { success: true, data };
  }

  // Public — fetch the guest's own RSVP to prefill the form on return.
  @Get("events/:eventId/rsvp/mine")
  async mine(
    @Param("eventId") eventId: string,
    @Query("email") email: string,
  ) {
    const data = await this.rsvpService.findMine(eventId, email);
    return { data };
  }

  // Organizer — mark a ceremony as started (live) and optionally email every
  // attending guest that it has begun. Drives the announcement bar on the
  // public wedding page.
  @Post("events/:eventId/functions/:functionId/announce")
  @UseGuards(AuthGuard("jwt"))
  async announceFunction(
    @Param("eventId") eventId: string,
    @Param("functionId") functionId: string,
    @Body() body: { isLive?: boolean; notify?: boolean },
  ) {
    return this.rsvpService.announceFunction(eventId, functionId, body || {});
  }

  // Organizer — allot rooms to a guest (per function).
  @Patch("events/:eventId/rsvps/:rsvpId/allotments")
  @UseGuards(AuthGuard("jwt"))
  async setAllotments(
    @Param("eventId") eventId: string,
    @Param("rsvpId") rsvpId: string,
    @Body() body: { allotments?: any[] },
  ) {
    const data = await this.rsvpService.setRoomAllotments(
      eventId,
      rsvpId,
      body?.allotments || [],
    );
    return { success: true, data };
  }

  // Organizer — email the guest their wedding room pass(es) with QR codes.
  @Post("events/:eventId/rsvps/:rsvpId/room-ticket")
  @UseGuards(AuthGuard("jwt"))
  async sendRoomTicket(
    @Param("eventId") eventId: string,
    @Param("rsvpId") rsvpId: string,
  ) {
    const data = await this.rsvpService.sendRoomTickets(eventId, rsvpId);
    return { success: true, ...data };
  }

  // Public (by QR token) — room-pass details for the reception check-in page.
  @Get("wedding-room/:token")
  async roomTicket(@Param("token") token: string) {
    return { data: await this.rsvpService.getRoomTicket(token) };
  }

  // Public (by QR token) — reception confirms the guest and allots the room.
  @Post("wedding-room/:token/check-in")
  async roomCheckIn(@Param("token") token: string) {
    return { data: await this.rsvpService.checkInRoom(token) };
  }

  // Organizer — the full RSVP guest list for an event (Participants tab).
  @Get("events/:eventId/rsvps")
  @UseGuards(AuthGuard("jwt"))
  async list(@Param("eventId") eventId: string) {
    const data = await this.rsvpService.listForEvent(eventId);
    const totalGuests = data
      .filter((r: any) => r.attending !== false)
      .reduce((sum: number, r: any) => sum + (Number(r.guestCount) || 0), 0);
    return {
      data,
      stats: {
        responses: data.length,
        attendingResponses: data.filter((r: any) => r.attending !== false)
          .length,
        totalGuests,
      },
    };
  }
}
