import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { MailService } from "../roles/mail.service";
import { OtpService } from "../otp/otp.service";
import { emailBrand } from "../../common/email/email-brand";
import {
  brandedEmail,
  button,
  code as codeBlock,
  escapeEmailHtml,
  heading,
  p,
  small,
  strong,
} from "../../common/email/email-layout";
import { plainName } from "../whatsapp/whatsapp-text";
import { EventAgent, EventAgentDocument } from "./schemas/event-agent.schema";
import {
  CreateEventAgentDto,
  ShareEventAgentDto,
  UpdateEventAgentDto,
} from "./dto/event-agent.dto";

/** What the event form's Agents tab is shown for one agent. */
export type EventAgentView = {
  id: string;
  name: string;
  whatsAppNumber: string;
  email: string;
  referralCode: string;
  /** 0 = unlimited. */
  maxUses: number;
  usedCount: number;
  /** Bookings the code may still be credited for; null when unlimited. */
  remaining: number | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  lastSharedAt: Date | null;
  shareCount: number;
  /** The public event link carrying this agent's code. */
  shareLink: string;
  createdAt: Date | null;
};

export type ShareResult = {
  whatsapp: "sent" | "failed" | "skipped";
  email: "sent" | "failed" | "skipped";
  shareLink: string;
};

/** A user as the passport JWT strategy puts it on the request. */
type Actor = { userId?: string; name?: string; roles?: string[]; operatorId?: string };

/** 7 uppercase letters/digits without 0/O and 1/I — the operator codes'
 * alphabet, so an agent code reads the same off a poster. */
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

/** Agents per event. Enough for a street team; the list stays readable. */
const MAX_AGENTS_PER_EVENT = 200;

/**
 * Per-event agents and their referral links (see EventAgent).
 *
 * Every route acts on an event the caller owns: the event's `organizer` must
 * be the organizer in the token (operators carry their parent organizer's id,
 * so they resolve to the same organizer). An agent is only ever read or
 * written through its event, so an agent id from another event's list is a
 * 404, never a cross-organizer edit.
 */
@Injectable()
export class EventAgentsService {
  private readonly logger = new Logger(EventAgentsService.name);

  constructor(
    @InjectModel(EventAgent.name)
    private readonly agentModel: Model<EventAgentDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("OrganizerStore") private readonly storeModel: Model<any>,
    // Operator codes share the `?ref=` namespace, so a new agent code must
    // not collide with one.
    @InjectModel("Operator") private readonly operatorModel: Model<any>,
    private readonly mailService: MailService,
    private readonly otpService: OtpService,
  ) {}

  // ── Ownership ────────────────────────────────────────────────────────────

  /** The event, when the caller's organizer owns it; 404/403 otherwise. */
  private async ownedEvent(eventId: string, actor: Actor) {
    if (!Types.ObjectId.isValid(String(eventId ?? ""))) {
      throw new NotFoundException("Event not found");
    }
    const event = await this.eventModel
      .findById(eventId)
      .select("title organizer slug startDate")
      .lean();
    if (!event) throw new NotFoundException("Event not found");
    const owner = String((event as any).organizer || "");
    const caller = String(actor?.userId || "");
    const isAdmin = Array.isArray(actor?.roles) && actor.roles.includes("admin");
    if (!isAdmin && (!caller || caller !== owner)) {
      throw new ForbiddenException("This event belongs to another organizer.");
    }
    return event as { _id: Types.ObjectId; title?: string; organizer: Types.ObjectId };
  }

  private async ownedAgent(eventId: string, agentId: string, actor: Actor) {
    const event = await this.ownedEvent(eventId, actor);
    if (!Types.ObjectId.isValid(String(agentId ?? ""))) {
      throw new NotFoundException("Agent not found");
    }
    const agent = await this.agentModel.findOne({
      _id: agentId,
      eventId: event._id,
    });
    if (!agent) throw new NotFoundException("Agent not found");
    return { event, agent };
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async list(eventId: string, actor: Actor): Promise<EventAgentView[]> {
    const event = await this.ownedEvent(eventId, actor);
    const [agents, linkBase] = await Promise.all([
      this.agentModel.find({ eventId: event._id }).sort({ createdAt: -1 }).lean(),
      this.eventLink(String(event.organizer), String(event._id)),
    ]);
    return agents.map((a) => toView(a, linkBase));
  }

  async create(
    eventId: string,
    dto: CreateEventAgentDto,
    actor: Actor,
  ): Promise<EventAgentView> {
    const event = await this.ownedEvent(eventId, actor);
    if (!dto.whatsAppNumber && !dto.email) {
      throw new BadRequestException(
        "Add a WhatsApp number or an email address, so the link can be sent to the agent.",
      );
    }
    const count = await this.agentModel.countDocuments({ eventId: event._id });
    if (count >= MAX_AGENTS_PER_EVENT) {
      throw new BadRequestException(
        `An event can have at most ${MAX_AGENTS_PER_EVENT} agents.`,
      );
    }
    const referralCode = await this.uniqueCode();
    const doc = await this.agentModel.create({
      eventId: event._id,
      organizerId: event.organizer,
      name: dto.name,
      whatsAppNumber: dto.whatsAppNumber || "",
      email: dto.email || "",
      referralCode,
      maxUses: Number(dto.maxUses) || 0,
      usedCount: 0,
      isActive: true,
      createdBy: String(actor?.userId || ""),
    });
    return toView(
      doc.toObject(),
      await this.eventLink(String(event.organizer), String(event._id)),
    );
  }

  async update(
    eventId: string,
    agentId: string,
    dto: UpdateEventAgentDto,
    actor: Actor,
  ): Promise<EventAgentView> {
    const { event, agent } = await this.ownedAgent(eventId, agentId, actor);
    if (dto.name !== undefined) agent.name = dto.name;
    if (dto.whatsAppNumber !== undefined) agent.whatsAppNumber = dto.whatsAppNumber;
    if (dto.email !== undefined) agent.email = dto.email;
    if (dto.maxUses !== undefined) agent.maxUses = Number(dto.maxUses) || 0;
    if (dto.isActive !== undefined) agent.isActive = !!dto.isActive;
    if (!agent.whatsAppNumber && !agent.email) {
      throw new BadRequestException(
        "Keep a WhatsApp number or an email address, so the link can be sent to the agent.",
      );
    }
    await agent.save();
    return toView(
      agent.toObject(),
      await this.eventLink(String(event.organizer), String(event._id)),
    );
  }

  async remove(eventId: string, agentId: string, actor: Actor): Promise<{ deleted: true }> {
    const { agent } = await this.ownedAgent(eventId, agentId, actor);
    // Bookings already credited keep their snapshot (referralAgentName), so
    // deleting the agent loses nothing in Participants; the code just stops
    // being credited.
    await agent.deleteOne();
    return { deleted: true };
  }

  /** A fresh code — the old link stops being credited at once. */
  async regenerateCode(eventId: string, agentId: string, actor: Actor): Promise<EventAgentView> {
    const { event, agent } = await this.ownedAgent(eventId, agentId, actor);
    agent.referralCode = await this.uniqueCode();
    await agent.save();
    return toView(
      agent.toObject(),
      await this.eventLink(String(event.organizer), String(event._id)),
    );
  }

  // ── Sharing ──────────────────────────────────────────────────────────────

  /**
   * Send the agent their link. WhatsApp goes out from the organizer's own
   * linked number when they have one (else the platform number while it is
   * on); email from the organizer's own sender when configured. Each channel
   * is independent and best-effort; the result says what went out, so the
   * form can offer a wa.me fallback for the rest.
   */
  async share(
    eventId: string,
    agentId: string,
    dto: ShareEventAgentDto,
    actor: Actor,
  ): Promise<ShareResult> {
    const { event, agent } = await this.ownedAgent(eventId, agentId, actor);
    const organizer: any = await this.organizerModel
      .findById(event.organizer)
      .select("organizationName name country emailConfig email")
      .lean();
    const organizerName = String(
      organizer?.organizationName || organizer?.name || emailBrand().name,
    );
    const shareLink = `${await this.eventLink(String(event.organizer), String(event._id))}?ref=${agent.referralCode}`;
    const channel = dto.channel || "both";
    const note = String(dto.note || "").trim();
    const eventTitle = String(event.title || "the event");
    const usesLine =
      agent.maxUses > 0
        ? `This code can be used for up to ${agent.maxUses} bookings (${Math.max(0, agent.maxUses - agent.usedCount)} left).`
        : "There is no limit on how many bookings this code can be used for.";

    const result: ShareResult = { whatsapp: "skipped", email: "skipped", shareLink };

    if ((channel === "whatsapp" || channel === "both") && agent.whatsAppNumber) {
      const text =
        `👋 Hi ${plainName(agent.name, "there")}!\n\n` +
        `You're an agent for *${eventTitle}* by ${organizerName}.\n\n` +
        (note ? `${note}\n\n` : "") +
        `Share this link with your contacts. Every booking made through it is credited to you:\n${shareLink}\n\n` +
        `Your referral code: *${agent.referralCode}*\n${usesLine}`;
      const sent = await this.otpService.trySendWhatsAppMessage(agent.whatsAppNumber, text, {
        organizerId: String(event.organizer),
        country: organizer?.country,
        organizerInitiated: true,
      });
      result.whatsapp = sent ? "sent" : "failed";
    }

    if ((channel === "email" || channel === "both") && agent.email) {
      try {
        await this.mailService.sendEmail({
          to: agent.email,
          subject: `Your referral link for ${eventTitle}`,
          html: brandedEmail({
            preheading: "Agent referral link",
            preview: `Share this link for ${eventTitle}; every booking through it is credited to you.`,
            organizer: organizerName,
            contact: organizer?.email
              ? { label: `write to ${organizer.email}`, href: `mailto:${organizer.email}` }
              : undefined,
            body:
              heading(`You're an agent for ${escapeEmailHtml(eventTitle)} 🎟️`) +
              p(`Hi ${escapeEmailHtml(agent.name)},`) +
              p(
                `${strong(escapeEmailHtml(organizerName))} has added you as an agent for ${strong(
                  escapeEmailHtml(eventTitle),
                )}. Share the link below with your contacts — every booking made through it is credited to you.`,
              ) +
              (note ? p(escapeEmailHtml(note)) : "") +
              button("Open your event link", shareLink) +
              p(`Or copy it: ${escapeEmailHtml(shareLink)}`) +
              small("Your referral code") +
              codeBlock(agent.referralCode) +
              small(escapeEmailHtml(usesLine)),
          }),
          senderConfig: organizer?.emailConfig,
        });
        result.email = "sent";
      } catch (err: any) {
        this.logger.warn(
          `Agent link email failed for agent ${agent._id}: ${err?.message || err}`,
        );
        result.email = "failed";
      }
    }

    if (result.whatsapp === "sent" || result.email === "sent") {
      agent.shareCount = (agent.shareCount || 0) + 1;
      agent.lastSharedAt = new Date();
      await agent.save();
    }
    return result;
  }

  // ── Public lookup ────────────────────────────────────────────────────────

  /**
   * The contact card the eventfront shows a visitor who arrived through an
   * agent's link: the agent's name and WhatsApp number, in place of the
   * organizer's. Public (the visitor is not logged in) and deliberately
   * minimal — only an ACTIVE agent of THAT event, only the two fields the
   * agent hands out on the link anyway, and nothing when the code is an
   * operator's or unknown. Codes are 7 characters from a 32-letter alphabet,
   * so guessing one is not practical, and the route is throttled.
   */
  async publicContact(
    eventId: string,
    code: string,
  ): Promise<{ name: string; whatsAppNumber: string; email: string } | null> {
    const normalized = String(code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(normalized)) return null;
    if (!Types.ObjectId.isValid(String(eventId ?? ""))) return null;
    const agent = await this.agentModel
      .findOne({
        eventId: new Types.ObjectId(String(eventId)),
        referralCode: normalized,
        isActive: true,
      })
      .select("name whatsAppNumber email")
      .lean();
    if (!agent) return null;
    return {
      name: String(agent.name || ""),
      whatsAppNumber: String(agent.whatsAppNumber || ""),
      email: String(agent.email || ""),
    };
  }

  /**
   * Does this code count for this event? Read-only (nothing is consumed):
   * an ACTIVE agent of the event with uses left, or one of the organizer's
   * operators with referrals on. Also says whether the event is referral-only
   * (Agents section on), so a checkout that pays before it books — the ticket
   * cart — can refuse to start payment without a valid code.
   */
  async checkReferral(
    eventId: string,
    code: string,
  ): Promise<{ required: boolean; valid: boolean }> {
    if (!Types.ObjectId.isValid(String(eventId ?? "")))
      return { required: false, valid: false };
    const event = await this.eventModel
      .findById(eventId)
      .select("organizer features")
      .lean();
    if (!event) return { required: false, valid: false };
    const required = !!(event as any).features?.hasAgents;
    const normalized = String(code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(normalized)) return { required, valid: false };
    const agent = await this.agentModel.exists({
      eventId: new Types.ObjectId(String(eventId)),
      referralCode: normalized,
      isActive: true,
      $expr: {
        $or: [{ $lte: ["$maxUses", 0] }, { $lt: ["$usedCount", "$maxUses"] }],
      },
    } as any);
    if (agent) return { required, valid: true };
    const operator = await this.operatorModel.exists({
      organizerId: String((event as any).organizer),
      referralCode: normalized,
      referralEnabled: true,
    });
    return { required, valid: !!operator };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * "https://eventsh.com/<organizer slug>/events/<event id>" — the same
   * public route the stall and ticket emails link to (stalls.service.ts's
   * buildEventFrontUrl), so the agent's link opens the eventfront page that
   * captures `?ref=`.
   */
  private async eventLink(organizerId: string, eventId: string): Promise<string> {
    const fe = (process.env.FRONTEND_BASE_URL || "https://eventsh.com").replace(/\/+$/, "");
    try {
      const store = await this.storeModel
        .findOne({ organizerId: { $in: [organizerId, new Types.ObjectId(organizerId)] } })
        .select("slug")
        .lean();
      let slug: string | undefined = (store as any)?.slug || undefined;
      if (!slug) {
        const org: any = await this.organizerModel
          .findById(organizerId)
          .select("slug organizationName")
          .lean();
        slug =
          org?.slug ||
          (org?.organizationName
            ? String(org.organizationName)
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
            : undefined);
      }
      if (slug) return `${fe}/${slug}/events/${eventId}`;
    } catch (err: any) {
      this.logger.warn(`Could not read the storefront slug for ${organizerId}: ${err?.message || err}`);
    }
    return `${fe}/events/${eventId}`;
  }

  /** A code no event agent and no operator holds. */
  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i += 1) {
        code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
      }
      const [agentTaken, operatorTaken] = await Promise.all([
        this.agentModel.exists({ referralCode: code }),
        this.operatorModel.exists({ referralCode: code }),
      ]);
      if (!agentTaken && !operatorTaken) return code;
    }
    throw new BadRequestException("Could not generate a referral code. Please try again.");
  }
}

function toView(a: any, linkBase: string): EventAgentView {
  const maxUses = Number(a?.maxUses) || 0;
  const usedCount = Number(a?.usedCount) || 0;
  return {
    id: String(a?._id ?? ""),
    name: String(a?.name ?? ""),
    whatsAppNumber: String(a?.whatsAppNumber ?? ""),
    email: String(a?.email ?? ""),
    referralCode: String(a?.referralCode ?? ""),
    maxUses,
    usedCount,
    remaining: maxUses > 0 ? Math.max(0, maxUses - usedCount) : null,
    isActive: a?.isActive !== false,
    lastUsedAt: a?.lastUsedAt ?? null,
    lastSharedAt: a?.lastSharedAt ?? null,
    shareCount: Number(a?.shareCount) || 0,
    shareLink: `${linkBase}?ref=${String(a?.referralCode ?? "")}`,
    createdAt: a?.createdAt ?? null,
  };
}
