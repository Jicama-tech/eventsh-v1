import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { EventAgentsService } from "./event-agents.service";

/**
 * The one unauthenticated agent route: the eventfront asks who the visitor's
 * `?ref=` code belongs to, so the Contact Organizer card can show the agent
 * who sent them instead of the organizer. Kept in its own controller so the
 * organizer routes' `AuthGuard("jwt")` stays at class level over there.
 *
 * Path: GET /events/:eventId/agents/contact?ref=CODE → `{ agent: {...} | null }`.
 * (`contact` is a fixed segment; the organizer controller has no GET with a
 * parameter under this prefix, so nothing shadows it.)
 */
@Controller("events/:eventId/agents")
@UseGuards(ThrottlerGuard)
export class EventAgentsPublicController {
  constructor(private readonly agents: EventAgentsService) {}

  @Get("contact")
  async contact(@Param("eventId") eventId: string, @Query("ref") ref?: string) {
    const agent = await this.agents.publicContact(eventId, ref || "");
    return { agent };
  }

  /** GET /events/:eventId/agents/check?ref=CODE → `{ required, valid }`.
   * Read-only; the ticket cart asks before payment on referral-only events. */
  @Get("check")
  async check(@Param("eventId") eventId: string, @Query("ref") ref?: string) {
    return this.agents.checkReferral(eventId, ref || "");
  }
}
