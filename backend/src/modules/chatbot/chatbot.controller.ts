import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ChatbotService } from "./chatbot.service";

@Controller("chatbot")
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Post("message")
  @UseGuards(AuthGuard("jwt"))
  async message(
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    const organizerId = req.user?.userId || req.user?.sub;
    const organizerName: string = req.user?.name || "there";
    const message = String(body.message || "").slice(0, 4000);
    const roles: string[] = Array.isArray(req.user?.roles)
      ? (req.user.roles as string[])
      : [];
    console.log(
      "[chatbot/message]",
      JSON.stringify({
        sub: req.user?.sub,
        email: req.user?.email,
        roles,
        msgPreview: message.slice(0, 60),
      }),
    );

    // Individual onboarding mode — user signed in via Google but hasn't
    // registered as an organizer yet. The main chatbot pipeline assumes a
    // valid Organizer document (it loads org settings, lists events, etc.),
    // which doesn't exist for Individuals. Short-circuit to a tiny handler
    // that can only do two things: open the Create Event form (will 403 on
    // submit) and open the organizer registration form.
    if (roles.includes("individual") && !roles.includes("organizer")) {
      return this.chatbot.handleIndividualMessage({
        userName: organizerName,
        userEmail: req.user?.email,
        message,
      });
    }

    // Operators have `accessTabs` on their JWT (see auth.controller.ts
    // mintOrganizerToken). Organizers don't — they get full access.
    const operatorAccessTabs: string[] | null = Array.isArray(
      req.user?.accessTabs,
    )
      ? (req.user.accessTabs as string[])
      : null;
    return this.chatbot.handleMessage({
      organizerId,
      organizerName,
      operatorAccessTabs,
      message,
    });
  }

  // Unauthenticated chatbot used on the public landing page. Answers a
  // curated FAQ corpus and surfaces an action payload when the user wants
  // to start creating their first event (the frontend then triggers
  // inline Google auth). No JWT, no organizer context.
  @Post("public-message")
  async publicMessage(@Body() body: { message: string }) {
    const message = String(body?.message || "").slice(0, 1000);
    return this.chatbot.handlePublicMessage({ message });
  }

  @Get("health")
  health() {
    return { ok: true, provider: this.chatbot.activeProvider };
  }

  // TEMP diagnostic: hit /chatbot/debug/individual?email=foo@bar.com OR
  // ?organizerId=XXX to see what the "my events" lookup would return.
  // Safe to remove once we're confident the flow works end-to-end.
  @Get("debug/individual")
  async debugIndividual(@Req() req: any) {
    return this.chatbot.debugIndividualLookup({
      email: req.query?.email ? String(req.query.email) : undefined,
      organizerId: req.query?.organizerId
        ? String(req.query.organizerId)
        : undefined,
    });
  }

  // TEMP diagnostic: dump the 10 most recently created events with their
  // organizer field so we can see where the user's "lost" event landed.
  @Get("debug/recent-events")
  async debugRecentEvents() {
    return this.chatbot.debugRecentEvents();
  }

  // TEMP diagnostic: list ALL organizer rows for an email so we can spot
  // duplicate / racey lazy-create rows.
  @Get("debug/organizers-by-email")
  async debugOrganizersByEmail(@Req() req: any) {
    return this.chatbot.debugOrganizersForEmail({
      email: String(req.query?.email || ""),
    });
  }

  // TEMP heal endpoint: relink orphan events + storefronts to the
  // canonical Organizer row for the given email.
  @Get("debug/heal-orphans")
  async debugHealOrphans(@Req() req: any) {
    return this.chatbot.healOrphansForEmail({
      email: String(req.query?.email || ""),
    });
  }

  // TEMP heal: zero-out visitor-type prices on Individual-tier events.
  // Pass ?email=foo@bar.com to scope to one user, or no email to fix
  // every Individual event in the DB.
  @Get("debug/heal-individual-prices")
  async debugHealIndividualPrices(@Req() req: any) {
    return this.chatbot.healIndividualTicketPrices({
      email: req.query?.email ? String(req.query.email) : undefined,
    });
  }

  // TEMP backfill: write organizerType on every existing organizer row.
  @Get("debug/backfill-organizer-type")
  async debugBackfillOrganizerType() {
    return this.chatbot.backfillOrganizerType();
  }
}
