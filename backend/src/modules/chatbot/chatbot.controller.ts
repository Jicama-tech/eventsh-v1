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
}
