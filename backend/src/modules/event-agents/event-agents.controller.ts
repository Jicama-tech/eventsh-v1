import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { TabsGuard } from "../../common/tabs/tabs.guard";
import { Tabs } from "../../common/tabs/tabs.decorator";
import {
  CreateEventAgentDto,
  ShareEventAgentDto,
  UpdateEventAgentDto,
} from "./dto/event-agent.dto";
import { EventAgentsService } from "./event-agents.service";

/**
 * The event form's Agents tab: `events/:eventId/agents`.
 *
 * A valid login, then the event's ownership (checked in the service against
 * the token's organizer, never a body field). Operators need the `events`
 * access tab, the same one that lets them edit the event.
 */
@Controller("events/:eventId/agents")
@UseGuards(AuthGuard("jwt"), TabsGuard)
@Tabs("events")
export class EventAgentsController {
  constructor(private readonly agents: EventAgentsService) {}

  @Get()
  list(@Req() req: any, @Param("eventId") eventId: string) {
    return this.agents.list(eventId, req.user);
  }

  @Post()
  create(
    @Req() req: any,
    @Param("eventId") eventId: string,
    @Body() dto: CreateEventAgentDto,
  ) {
    return this.agents.create(eventId, dto, req.user);
  }

  @Patch(":agentId")
  update(
    @Req() req: any,
    @Param("eventId") eventId: string,
    @Param("agentId") agentId: string,
    @Body() dto: UpdateEventAgentDto,
  ) {
    return this.agents.update(eventId, agentId, dto, req.user);
  }

  @Delete(":agentId")
  remove(
    @Req() req: any,
    @Param("eventId") eventId: string,
    @Param("agentId") agentId: string,
  ) {
    return this.agents.remove(eventId, agentId, req.user);
  }

  /** Send the agent their link on WhatsApp and/or email. */
  @Post(":agentId/share")
  @HttpCode(200)
  share(
    @Req() req: any,
    @Param("eventId") eventId: string,
    @Param("agentId") agentId: string,
    @Body() dto: ShareEventAgentDto,
  ) {
    return this.agents.share(eventId, agentId, dto, req.user);
  }

  /** Issue a new code; links carrying the old one stop being credited. */
  @Post(":agentId/regenerate-code")
  @HttpCode(200)
  regenerate(
    @Req() req: any,
    @Param("eventId") eventId: string,
    @Param("agentId") agentId: string,
  ) {
    return this.agents.regenerateCode(eventId, agentId, req.user);
  }
}
