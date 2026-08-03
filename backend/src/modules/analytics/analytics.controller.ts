import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";

// Revenue, costs and net profit are commercially sensitive — every route
// here requires a signed-in caller.
@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Full money picture for one event: revenue, costs, net profit. */
  @Get("event/:eventId/pnl")
  async eventPnl(@Param("eventId") eventId: string) {
    const data = await this.analyticsService.eventPnl(eventId);
    return { success: true, message: "Event P&L built", data };
  }

  /** The same, per event, across everything an organizer runs. */
  @Get("organizer/:organizerId/pnl")
  async organizerPnl(@Param("organizerId") organizerId: string) {
    const data = await this.analyticsService.organizerPnl(organizerId);
    return { success: true, message: "Organizer P&L built", data };
  }
}
