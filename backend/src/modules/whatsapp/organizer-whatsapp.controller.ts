import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { PlanAccessService } from "../../common/plan-access/plan-access.service";
import { TabsGuard } from "../../common/tabs/tabs.guard";
import { Tabs } from "../../common/tabs/tabs.decorator";
import { SendWhatsappDto } from "./dto/send-whatsapp.dto";
import {
  OrganizerWhatsappService,
  OrganizerWhatsappState,
  WHATSAPP_CONNECT_FEATURE,
} from "./organizer-whatsapp.service";

/** Minimum gap between two test messages from the same organizer. */
const TEST_SEND_COOLDOWN_MS = 5_000;
/** Minimum gap between two switch-ons or link attempts from the same
 * organizer. Each one can open a fresh WhatsApp login from the server's
 * single IP. */
const CONNECT_COOLDOWN_MS = 3_000;

const PLAN_REFUSAL =
  "WhatsApp Connection isn't included in your current plan. Upgrade your subscription to send from your own WhatsApp number.";

/**
 * Settings › Profile › WhatsApp: an organizer links ITS OWN number and
 * switches it on or off.
 *
 * The organizer is always the one in the token — never an id from the URL or
 * the body. The QR is a pairing credential: whoever scans it links their phone
 * as the organizer's sender, so being able to ask for another organizer's QR
 * would be a takeover. There is deliberately no route here that names an
 * organizer.
 *
 * Two guards, in order: a valid login (the passport strategy, which puts
 * `userId`, `roles` and `operatorId` on `req.user`); and, for operators, the
 * `whatsapp` access tab, re-read from the database so that revoking it takes
 * effect immediately. An operator who holds the tab (or has no tab
 * restrictions at all) gets the whole card — pairing included — exactly as
 * the owner does. Individual (wedding/party) accounts have no organizer role
 * and are refused: their events belong to a placeholder Organizer record that
 * cannot be messaged.
 *
 * The plan is required per route, not for the whole controller: starting or
 * using a session needs it, but reading the status, switching off and
 * unlinking must keep working after the add-on lapses. Otherwise an
 * organizer that stopped paying could not take its own phone off the server.
 */
@Controller("whatsapp")
@UseGuards(AuthGuard("jwt"), TabsGuard)
@Tabs("whatsapp")
export class OrganizerWhatsappController {
  /** Last test send per organizer. In memory, which is enough for a courtesy
   * limit on a button — it is not what protects the number from bulk
   * sending. */
  private readonly lastTestSend = new Map<string, number>();
  /** Last switch-on / link attempt per organizer — see CONNECT_COOLDOWN_MS. */
  private readonly lastConnect = new Map<string, number>();

  constructor(
    private readonly whatsapp: OrganizerWhatsappService,
    private readonly access: PlanAccessService,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
  ) {}

  /**
   * The organizer this request acts for. Operators carry their parent
   * organizer's id as `userId` and the "organizer" role, so they resolve to
   * the organizer too; other account types have no number to link.
   */
  private organizerIdOf(req: any): string {
    const raw = req?.user?.roles;
    const roles: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const isOrganizer = roles.some(
      (r) => String(r).toLowerCase() === "organizer",
    );
    const id = String(req?.user?.userId || "");
    if (!isOrganizer || !id) {
      throw new ForbiddenException(
        "Only an organizer account can link WhatsApp.",
      );
    }
    return id;
  }

  private async requirePlan(id: string) {
    if (!(await this.access.isEnabled(id, WHATSAPP_CONNECT_FEATURE))) {
      throw new ForbiddenException(PLAN_REFUSAL);
    }
  }

  /** The session as it stands. Polled by the card while a QR is up, because
   * the QR rotates and a stale one simply does not scan. */
  @Get("status")
  status(@Req() req: any): Promise<OrganizerWhatsappState> {
    return this.whatsapp.getState(this.organizerIdOf(req));
  }

  /** Switch on: persist the flag, then open a session. A phone linked before
   * reconnects silently; an unlinked organizer gets a QR, since a person just
   * clicked and is looking at the card. */
  @Post("enable")
  async enable(@Req() req: any): Promise<OrganizerWhatsappState> {
    const id = this.organizerIdOf(req);
    await this.requirePlan(id);
    this.throttle(this.lastConnect, id, CONNECT_COOLDOWN_MS);
    await this.whatsapp.setEnabled(id, true);
    await this.whatsapp.connect(id, { interactive: true });
    return this.whatsapp.getState(id);
  }

  /** Switch off. Closes the socket but KEEPS the pairing, so switching back
   * on does not need the phone again. Unlinking is a separate, louder action
   * — see disconnect(). */
  @Post("disable")
  async disable(@Req() req: any): Promise<OrganizerWhatsappState> {
    const id = this.organizerIdOf(req);
    await this.whatsapp.setEnabled(id, false);
    await this.whatsapp.suspend(id);
    return this.whatsapp.getState(id);
  }

  /** "Show QR code" / "Reconnect": a fresh attempt, and the only way to get a
   * new QR after one expired unscanned. */
  @Post("connect")
  async connect(@Req() req: any): Promise<OrganizerWhatsappState> {
    const id = this.organizerIdOf(req);
    await this.requirePlan(id);
    if (!(await this.whatsapp.isSwitchedOn(id))) {
      throw new BadRequestException("Turn WhatsApp on first.");
    }
    this.throttle(this.lastConnect, id, CONNECT_COOLDOWN_MS);
    await this.whatsapp.connect(id, { interactive: true });
    return this.whatsapp.getState(id);
  }

  /** Unlink the phone and delete the pairing. The next link starts from a
   * new QR. */
  @Post("disconnect")
  async disconnect(@Req() req: any): Promise<OrganizerWhatsappState> {
    const id = this.organizerIdOf(req);
    await this.whatsapp.disconnect(id);
    return this.whatsapp.getState(id);
  }

  /** Prove a freshly linked phone can actually send. */
  @Post("send")
  async send(
    @Req() req: any,
    @Body() dto: SendWhatsappDto,
  ): Promise<{ ok: true }> {
    const id = this.organizerIdOf(req);
    await this.requirePlan(id);
    this.throttle(
      this.lastTestSend,
      id,
      TEST_SEND_COOLDOWN_MS,
      "Please wait a few seconds before sending another test.",
    );

    // A number typed without a country code is read as local to the organizer.
    const organizer = await this.organizerModel
      .findById(id)
      .select("country")
      .lean();
    await this.whatsapp.sendText(
      id,
      dto.phone,
      dto.message,
      (organizer as any)?.country,
    );
    return { ok: true };
  }

  /**
   * Refuse with 429 if this organizer used `stamps` less than `gapMs` ago.
   * Stamped before the work runs, so a burst of clicks is one attempt even
   * when the first is still in flight or fails.
   */
  private throttle(
    stamps: Map<string, number>,
    id: string,
    gapMs: number,
    message = "Please wait a few seconds before trying again.",
  ) {
    const now = Date.now();
    if (now - (stamps.get(id) ?? 0) < gapMs) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
    stamps.set(id, now);
    // Keeps the map from growing with every organizer that ever clicked.
    if (stamps.size >= 500) {
      for (const [organizerId, at] of stamps) {
        if (now - at >= gapMs) stamps.delete(organizerId);
      }
    }
  }
}
