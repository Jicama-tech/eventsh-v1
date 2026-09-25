import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PlanAccessService } from "../../common/plan-access/plan-access.service";
import { TabsGuard } from "../../common/tabs/tabs.guard";
import { Tabs } from "../../common/tabs/tabs.decorator";
import { WHATSAPP_CONNECT_FEATURE } from "../whatsapp/organizer-whatsapp.service";
import { CampaignRequestDto, ContactsQueryDto, requestedSources } from "./dto/campaign-request.dto";
import { SetOptOutDto } from "./dto/opt-out.dto";
import { CampaignCreator } from "./entities/whatsapp-campaign.entity";
import {
  CampaignDetail,
  CampaignPreview,
  CampaignSummary,
  CampaignsService,
  WHATSAPP_CAMPAIGN_FEATURE,
} from "./campaigns.service";
import { CampaignAudienceService } from "./campaign-audience";

const CAMPAIGN_PLAN_REFUSAL =
  "WhatsApp Campaigns aren't included in your current plan. Upgrade your subscription to send campaigns.";
const CONNECT_PLAN_REFUSAL =
  "WhatsApp Connection isn't included in your current plan, so campaigns cannot be sent from your number.";

/**
 * WhatsApp › Campaigns: personalised messages from the organizer's own
 * linked number to the organizer's own contacts.
 *
 * The organizer is always the one in the token — never an id from the URL or
 * the body — and the audience is contact ids the server checks belong to it.
 * A route that let a caller name the organizer, or post phone numbers, would
 * let anyone use an organizer's WhatsApp to message anyone.
 *
 * Two guards, in order: a valid login; and, for operators, the `whatsapp`
 * access tab, re-read from the database on every request.
 *
 * The plan is required per route. Previewing and listing contacts need the
 * campaign module only, so an organizer can write and check a campaign
 * before linking WhatsApp; sending and resuming need the WhatsApp add-on too.
 * Reading history, stopping a campaign and the opt-out list stay open after a
 * plan lapses: an organizer must always be able to stop sending and to honour
 * a person's "no more messages".
 */
@Controller("campaigns/whatsapp")
@UseGuards(AuthGuard("jwt"), TabsGuard)
@Tabs("whatsapp")
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly audience: CampaignAudienceService,
    private readonly access: PlanAccessService,
  ) {}

  /** The organizer this request acts for. Operators carry their parent
   * organizer's id as `userId` and the "organizer" role. */
  private organizerIdOf(req: any): string {
    const raw = req?.user?.roles;
    const roles: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const isOrganizer = roles.some((r) => String(r).toLowerCase() === "organizer");
    const id = String(req?.user?.userId || "");
    if (!isOrganizer || !id) {
      throw new ForbiddenException("Only an organizer account can send WhatsApp campaigns.");
    }
    return id;
  }

  /** Who is starting it — the organizer, or which operator — for the history. */
  private creatorOf(req: any): CampaignCreator {
    return {
      userId: String(req?.user?.userId || ""),
      operatorId: req?.user?.operatorId ? String(req.user.operatorId) : null,
      name: String(req?.user?.name || ""),
    };
  }

  private async requireCampaignPlan(id: string, withConnect: boolean) {
    if (!(await this.access.isEnabled(id, WHATSAPP_CAMPAIGN_FEATURE))) {
      throw new ForbiddenException(CAMPAIGN_PLAN_REFUSAL);
    }
    if (withConnect && !(await this.access.isEnabled(id, WHATSAPP_CONNECT_FEATURE))) {
      throw new ForbiddenException(CONNECT_PLAN_REFUSAL);
    }
  }

  /** The organizer's events, for the composer's picker. */
  @Get("events")
  async events(@Req() req: any) {
    const id = this.organizerIdOf(req);
    await this.requireCampaignPlan(id, false);
    return { events: await this.audience.listEvents(id) };
  }

  /** The people a campaign can go to, from one source (or all), optionally
   * narrowed to an event. Numbers are the organizer's own records, shown in
   * the organizer's own dashboard. */
  @Get("contacts")
  async contacts(@Req() req: any, @Query() query: ContactsQueryDto) {
    const id = this.organizerIdOf(req);
    await this.requireCampaignPlan(id, false);
    const { contacts, truncated } = await this.audience.listContacts(
      id,
      requestedSources(query),
      query.eventId,
    );
    return { contacts, truncated };
  }

  @Post("preview")
  @HttpCode(200)
  async preview(@Req() req: any, @Body() dto: CampaignRequestDto): Promise<CampaignPreview> {
    const id = this.organizerIdOf(req);
    await this.requireCampaignPlan(id, false);
    return this.campaigns.preview(id, dto);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CampaignRequestDto): Promise<CampaignSummary> {
    const id = this.organizerIdOf(req);
    await this.requireCampaignPlan(id, true);
    return this.campaigns.create(id, dto, this.creatorOf(req));
  }

  @Get()
  list(@Req() req: any): Promise<CampaignSummary[]> {
    return this.campaigns.list(this.organizerIdOf(req));
  }

  // Declared before `:id`, which would otherwise read "opt-outs" as an id.
  @Get("opt-outs")
  optOuts(@Req() req: any) {
    return this.audience.listOptOuts(this.organizerIdOf(req));
  }

  @Put("opt-outs/:contactId")
  setOptOut(
    @Req() req: any,
    @Param("contactId") contactId: string,
    @Body() dto: SetOptOutDto,
  ) {
    return this.audience.setOptOut(this.organizerIdOf(req), contactId, dto.optedOut);
  }

  @Get(":id")
  detail(@Req() req: any, @Param("id") id: string): Promise<CampaignDetail> {
    return this.campaigns.detail(this.organizerIdOf(req), id);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  cancel(@Req() req: any, @Param("id") id: string): Promise<CampaignSummary> {
    return this.campaigns.cancel(this.organizerIdOf(req), id);
  }

  @Post(":id/resume")
  @HttpCode(200)
  async resume(@Req() req: any, @Param("id") id: string): Promise<CampaignSummary> {
    const organizerId = this.organizerIdOf(req);
    await this.requireCampaignPlan(organizerId, true);
    return this.campaigns.resume(organizerId, id);
  }
}
