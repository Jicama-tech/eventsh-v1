import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  eventHasEnded,
  EVENT_ENDED_MESSAGE,
} from "../../common/event-timing.util";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as puppeteer from "puppeteer";
import {
  SpeakerRequest,
  SpeakerRequestDocument,
} from "./entities/speaker-request.entity";
import {
  CreateSpeakerRequestDto,
  UpdateSpeakerRequestStatusDto,
  UpdateSpeakerFeeDto,
  ConfirmSessionTimesDto,
} from "./dto/create-speaker-request.dto";
import { Speaker, SpeakerDocument } from "./schemas/speaker.schema";
import { OtpService } from "../otp/otp.service";
import { FeedbackService } from "../feedback/feedback.service";
import { MailService } from "../roles/mail.service";

@Injectable()
export class SpeakerRequestsService {
  private readonly logger = new Logger(SpeakerRequestsService.name);

  constructor(
    @InjectModel(SpeakerRequest.name)
    private speakerRequestModel: Model<SpeakerRequestDocument>,
    @InjectModel(Speaker.name)
    private speakerModel: Model<SpeakerDocument>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    private otpService: OtpService,
    private feedbackService: FeedbackService,
    private mailService: MailService,
  ) {
    const ticketsDir = path.join(process.cwd(), "uploads", "speakerTickets");
    if (!fs.existsSync(ticketsDir))
      fs.mkdirSync(ticketsDir, { recursive: true });
  }

  // ============ SPEAKER PROFILE (persistent roster) ============

  /**
   * How a person is recognised on the roster: by email when we have one,
   * otherwise by their name. Speakers typed into the Create Event form often
   * have no email, and without a fallback identity every re-save of the event
   * would clone them.
   */
  private rosterIdentity(
    organizerId: string | Types.ObjectId,
    email?: string,
    name?: string,
  ) {
    const clean = String(email || "")
      .trim()
      .toLowerCase();
    const nameKey = String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    // Accept a raw id, an ObjectId, or a populated Organizer document.
    const ownerRaw = (organizerId as any)?._id ?? organizerId;
    const owner = ownerRaw ? String(ownerRaw) : "";
    if (!Types.ObjectId.isValid(owner)) return { filter: null, nameKey };
    const org = new Types.ObjectId(owner);
    if (clean) return { filter: { organizerId: org, email: clean }, nameKey };
    if (nameKey) return { filter: { organizerId: org, nameKey }, nameKey };
    return { filter: null, nameKey };
  }

  /**
   * Create or refresh this organizer's profile for a speaker.
   *
   * Called on every application so the roster grows by itself, exactly like a
   * stall booking upserting its vendor. Email is the identity (Google-verified
   * on the eventfront), so the same person applying to five events keeps ONE
   * profile whose details improve each time. Never overwrites a stored value
   * with a blank one — a half-filled application must not erase a good bio.
   */
  async upsertSpeakerProfile(
    organizerId: string | Types.ObjectId,
    data: {
      email?: string;
      name?: string;
      phone?: string;
      title?: string;
      organization?: string;
      bio?: string;
      expertise?: string;
      image?: string;
      socialLinks?: Record<string, string>;
      previousSpeakingExperience?: string;
      equipmentNeeded?: string;
    },
    opts?: {
      /** Count this as an application (an eventfront apply, not an event-form save). */
      countApplication?: boolean;
      origin?: "application" | "event-form" | "crm";
    },
  ): Promise<SpeakerDocument | null> {
    if (!organizerId) return null;
    const email = String(data.email || "")
      .trim()
      .toLowerCase();
    const { filter, nameKey } = this.rosterIdentity(
      organizerId,
      email,
      data.name,
    );
    // Neither an email nor a name — nothing to key a profile on.
    if (!filter) return null;

    // Only non-empty fields participate in the update.
    const set: Record<string, any> = { email, nameKey };
    const keep = (k: string, v: any) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") set[k] = v;
    };
    keep("name", data.name);
    keep("phone", data.phone);
    keep("title", data.title);
    keep("organization", data.organization);
    keep("bio", data.bio);
    keep("expertise", data.expertise);
    keep("image", data.image);
    keep("previousSpeakingExperience", data.previousSpeakingExperience);
    keep("equipmentNeeded", data.equipmentNeeded);
    if (data.socialLinks && Object.values(data.socialLinks).some(Boolean)) {
      set.socialLinks = data.socialLinks;
    }
    set.lastAppliedAt = new Date();

    try {
      const update: any = {
        $set: set,
        $setOnInsert: {
          // Reuse the id the identity filter already validated/unwrapped,
          // rather than re-casting the caller's (possibly populated) value.
          organizerId: (filter as any).organizerId,
          confirmedSessions: 0,
          origin: opts?.origin || "application",
        },
      };
      // An event-form save isn't an application — don't inflate the count.
      if (opts?.countApplication !== false) {
        update.$inc = { totalApplications: 1 };
      } else {
        update.$setOnInsert.totalApplications = 0;
      }
      return await this.speakerModel.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      });
    } catch (err) {
      // A duplicate-key race (two applications at once) is harmless — the
      // profile exists either way and the request itself must still save.
      this.logger.warn(
        `Speaker profile upsert failed for ${email}: ${
          (err as any)?.message || err
        }`,
      );
      return null;
    }
  }

  /** Look a speaker up by email so the eventfront can prefill step 1. */
  async findSpeakerProfile(email: string, organizerId?: string) {
    const clean = String(email || "")
      .trim()
      .toLowerCase();
    if (!clean) return { success: true, data: null };
    const query: any = { email: clean };
    if (organizerId && Types.ObjectId.isValid(organizerId)) {
      query.organizerId = new Types.ObjectId(organizerId);
    }
    // Newest first: with no organizer scope, the most recent profile is the
    // best guess at their current details.
    const profile = await this.speakerModel
      .findOne(query)
      .sort({ updatedAt: -1 })
      .lean();
    return { success: true, data: profile || null };
  }

  /**
   * Create or edit a roster entry from the CRM.
   *
   * Deliberately upsert-by-email rather than blind insert: an organizer typing
   * in someone who already applied should land on the SAME profile, not a
   * duplicate that splits their history. Unlike the application-time upsert,
   * this one is an explicit edit — a cleared field is a real instruction, so
   * blanks are written through (except the photo, which only changes when a
   * new file is uploaded).
   */
  async saveSpeakerProfile(body: any) {
    const organizerId = String(body.organizerId || "");
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("A valid organizerId is required");
    }
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!email) throw new BadRequestException("An email is required");
    if (!String(body.name || "").trim()) {
      throw new BadRequestException("A name is required");
    }

    const fields: Record<string, any> = {
      name: String(body.name).trim(),
      phone: body.phone ?? "",
      title: body.title ?? "",
      organization: body.organization ?? "",
      bio: body.bio ?? "",
      expertise: body.expertise ?? "",
      previousSpeakingExperience: body.previousSpeakingExperience ?? "",
      equipmentNeeded: body.equipmentNeeded ?? "",
      organizerNotes: body.organizerNotes ?? "",
      socialLinks: body.socialLinks || {
        linkedin: "",
        twitter: "",
        website: "",
      },
    };
    // Only replace the photo when a new one came with the request — editing a
    // name must not wipe the headshot.
    if (body.image) fields.image = body.image;

    const existing = await this.speakerModel.findOne({
      organizerId: new Types.ObjectId(organizerId),
      email,
    });

    if (body.id && Types.ObjectId.isValid(body.id)) {
      const updated = await this.speakerModel.findByIdAndUpdate(
        body.id,
        { $set: { ...fields, email } },
        { new: true },
      );
      if (!updated) throw new NotFoundException("Speaker profile not found");
      return { success: true, message: "Speaker updated", data: updated };
    }

    if (existing) {
      const updated = await this.speakerModel.findByIdAndUpdate(
        existing._id,
        { $set: fields },
        { new: true },
      );
      return {
        success: true,
        message: "This email was already on your roster — profile updated",
        data: updated,
      };
    }

    const created = await this.speakerModel.create({
      organizerId: new Types.ObjectId(organizerId),
      email,
      ...fields,
      totalApplications: 0,
      confirmedSessions: 0,
    });
    return { success: true, message: "Speaker added", data: created };
  }

  /** Remove a roster entry. Past applications/requests are left untouched. */
  async removeSpeakerProfile(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid speaker ID");
    }
    const deleted = await this.speakerModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException("Speaker profile not found");
    return { success: true, message: "Speaker removed from your roster" };
  }

  /**
   * Fold an event's speaker line-up into the roster.
   *
   * Called whenever an event is created or updated, so speakers the organizer
   * types into the Create Event form show up in the CRM alongside the ones who
   * applied through an event page. Idempotent by design — re-saving the same
   * event matches the existing profile (on email, or on name when there's no
   * email) and updates it instead of adding a twin. Best-effort: the roster is
   * never worth failing an event save over.
   */
  async syncEventSpeakersToRoster(event: any) {
    // The owner arrives in three shapes depending on the caller: a raw string
    // (create returns the saved doc), a POPULATED Organizer object (update
    // populates it), or the legacy `organizerId`. Unwrap before casting —
    // stringifying a populated document yields junk that fails the ObjectId
    // cast, which is exactly how this silently synced nothing on edit.
    const rawOwner = event?.organizer ?? event?.organizerId;
    const owner = (rawOwner as any)?._id ?? rawOwner;
    const organizerId = owner ? String(owner) : "";
    const speakers: any[] = Array.isArray(event?.speakers)
      ? event.speakers
      : [];
    if (!Types.ObjectId.isValid(organizerId) || speakers.length === 0) {
      if (speakers.length && !Types.ObjectId.isValid(organizerId)) {
        this.logger.warn(
          `Roster sync skipped for "${event?.title}" — couldn't resolve the organizer id from ${typeof rawOwner}.`,
        );
      }
      return { synced: 0 };
    }

    let synced = 0;
    for (const s of speakers) {
      if (!String(s?.name || "").trim()) continue;
      try {
        const profile = await this.upsertSpeakerProfile(
          organizerId,
          {
            email: s.email,
            name: s.name,
            title: s.title,
            organization: s.organization,
            bio: s.bio,
            image: s.image,
            socialLinks: s.socialLinks,
          },
          { countApplication: false, origin: "event-form" },
        );
        if (profile) synced++;
      } catch (err) {
        this.logger.warn(
          `Roster sync skipped ${s?.name}: ${(err as any)?.message || err}`,
        );
      }
    }
    if (synced) {
      this.logger.log(
        `Synced ${synced} speaker(s) from event "${event?.title}" into the roster.`,
      );
    }
    return { synced };
  }

  /**
   * Everything this speaker has done with this organizer: the events they were
   * booked on (from each event's line-up) and every application they've made,
   * newest first. Powers the CRM's detail view.
   */
  async getSpeakerHistory(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid speaker ID");
    }
    const profile = await this.speakerModel.findById(id).lean();
    if (!profile) throw new NotFoundException("Speaker profile not found");

    const email = String(profile.email || "").toLowerCase();
    const nameKey = String(profile.nameKey || "").toLowerCase();

    // Applications (eventfront), matched on email.
    const requests = email
      ? await this.speakerRequestModel
          .find({ organizerId: profile.organizerId, email })
          .populate({
            path: "eventId",
            select: "title location startDate endDate",
          })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Line-ups the organizer built by hand. An event's speakers[] carries no
    // link back here, so match the same way the roster de-duplicates.
    //
    // The events collection stores the owner inconsistently — `organizer` as a
    // raw string on some documents, an ObjectId on others, and older rows use
    // `organizerId`. Match every shape or the history comes back empty.
    const orgVariants: any[] = [
      profile.organizerId,
      String(profile.organizerId),
    ];
    const events = await this.eventModel
      .find({
        $or: [
          { organizer: { $in: orgVariants } },
          { organizerId: { $in: orgVariants } },
        ],
        "speakers.0": { $exists: true },
      })
      .select("title location startDate endDate speakers")
      .sort({ startDate: -1 })
      .lean();

    const sessions: any[] = [];
    for (const ev of events as any[]) {
      for (const s of ev.speakers || []) {
        const sEmail = String(s.email || "").toLowerCase();
        const sName = String(s.name || "")
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase();
        const matches = email
          ? sEmail === email
          : !!nameKey && sName === nameKey;
        if (!matches) continue;
        sessions.push({
          eventId: ev._id,
          eventTitle: ev.title,
          location: ev.location,
          startDate: ev.startDate,
          endDate: ev.endDate,
          isKeynote: !!s.isKeynote,
          slots: s.slots || [],
          source: "event-lineup",
        });
      }
    }

    return {
      success: true,
      data: {
        profile,
        // One row per application, with its status and fee.
        applications: (requests as any[]).map((r) => ({
          _id: r._id,
          eventId: r.eventId?._id || r.eventId,
          eventTitle: r.eventId?.title || "(event removed)",
          startDate: r.eventId?.startDate,
          status: r.status,
          paymentStatus: r.paymentStatus,
          fee: r.fee,
          isCharged: r.isCharged,
          selectedSlotName: r.selectedSlotName,
          sessions: r.sessions || [],
          createdAt: r.createdAt,
        })),
        // Events where they actually appear in the published line-up.
        sessions,
      },
    };
  }

  /** The organizer's whole speaker roster, for reuse on future events. */
  async findSpeakersByOrganizer(organizerId: string) {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer ID");
    }
    const data = await this.speakerModel
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .sort({ lastAppliedAt: -1 })
      .lean();
    return { success: true, data };
  }

  // ============ SLOT PRICING ============

  /**
   * Price the speaker space the applicant chose. The slot templates live on
   * the event, so the fee is resolved server-side at apply time and frozen on
   * the request — a later edit to the template can't silently re-price an
   * application that's already in flight.
   */
  private resolveSlotFee(event: any, selectedSlotId?: string) {
    const templates: any[] = Array.isArray(event?.speakerSlotTemplates)
      ? event.speakerSlotTemplates
      : [];
    const slot = selectedSlotId
      ? templates.find((t) => String(t.id) === String(selectedSlotId))
      : null;
    const fee = Number(slot?.slotPrice) || 0;
    return {
      slot,
      fee,
      isCharged: fee > 0,
      // "Waived" is the free-slot resting state the rest of the service
      // already understands; a paid slot starts Unpaid.
      paymentStatus: fee > 0 ? "Unpaid" : "Waived",
    };
  }

  // ============ EMAIL ============

  /** Organizer's custom sender config, when they've set one up. */
  private async senderConfigFor(organizerId: any) {
    try {
      const org = await this.organizerModel
        .findById(organizerId)
        .select("emailConfig")
        .lean();
      return (org as any)?.emailConfig;
    } catch {
      return undefined;
    }
  }

  /**
   * Branded speaker email. Best-effort by design: a bounced notification must
   * never roll back an approval or a payment confirmation.
   */
  private async sendSpeakerEmail(opts: {
    to?: string;
    organizerId: any;
    subject: string;
    heading: string;
    bodyHtml: string;
    accent?: string;
    attachments?: any[];
  }) {
    if (!opts.to) return false;
    try {
      const senderConfig = await this.senderConfigFor(opts.organizerId);
      await this.mailService.sendEmail({
        to: opts.to,
        subject: opts.subject,
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:${opts.accent || "linear-gradient(135deg,#6366f1,#4f46e5)"};color:#fff;padding:24px;text-align:center">
          <h1 style="margin:0;font-size:20px">${opts.heading}</h1>
        </div>
        <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.7">
          ${opts.bodyHtml}
        </div>
      </div>`,
        attachments: opts.attachments,
        senderConfig,
      });
      return true;
    } catch (err) {
      this.logger.error(
        `Speaker email "${opts.subject}" to ${opts.to} failed: ${
          (err as any)?.message || err
        }`,
      );
      return false;
    }
  }

  /** Shared session/summary block reused across the speaker emails. */
  private speakerSummaryHtml(request: any, event: any, fee?: number) {
    const when = event?.startDate
      ? new Date(event.startDate).toLocaleDateString()
      : "TBA";
    const sessions = (request.sessions || [])
      .map(
        (s: any) =>
          `<li><strong>${s.topic || "Session"}</strong>${
            s.confirmedStartTime || s.preferredStartTime
              ? ` — ${s.confirmedStartTime || s.preferredStartTime} to ${
                  s.confirmedEndTime || s.preferredEndTime || ""
                }`
              : ""
          }</li>`,
      )
      .join("");
    return `
      <p style="margin:0 0 12px"><strong>Event:</strong> ${event?.title || "Event"}<br/>
      <strong>Date:</strong> ${when}<br/>
      <strong>Venue:</strong> ${event?.location || "TBA"}${
        request.selectedSlotName
          ? `<br/><strong>Speaker space:</strong> ${request.selectedSlotName}`
          : ""
      }${
        fee && fee > 0
          ? `<br/><strong>Slot fee:</strong> ${fee}`
          : request.isCharged === false || !request.fee
            ? `<br/><strong>Slot fee:</strong> Free`
            : ""
      }</p>
      ${sessions ? `<p style="margin:0 0 8px"><strong>Your session${(request.sessions || []).length > 1 ? "s" : ""}:</strong></p><ul style="margin:0 0 12px;padding-left:18px">${sessions}</ul>` : ""}`;
  }

  // ============ PHASE 1: APPLY AS SPEAKER ============
  async create(dto: CreateSpeakerRequestDto) {
    try {
      const event = await this.eventModel.findById(dto.eventId);
      if (!event) throw new NotFoundException("Event not found");
      // Past events accept no new speaker applications.
      if (eventHasEnded(event)) {
        throw new BadRequestException(EVENT_ENDED_MESSAGE);
      }

      if (dto.email) {
        const existing = await this.speakerRequestModel.findOne({
          eventId: new Types.ObjectId(dto.eventId),
          email: dto.email,
          status: { $nin: ["Cancelled", "Rejected"] },
        });
        if (existing) {
          throw new ConflictException(
            "You already have a pending or approved speaker application for this event",
          );
        }
      }

      // Price the chosen speaker space now and freeze it on the request.
      const pricing = this.resolveSlotFee(event, (dto as any).selectedSlotId);

      const request = await this.speakerRequestModel.create({
        ...dto,
        email: String(dto.email || "")
          .trim()
          .toLowerCase(),
        eventId: new Types.ObjectId(dto.eventId),
        organizerId: new Types.ObjectId(dto.organizerId),
        status: "Pending",
        isCharged: pricing.isCharged,
        fee: pricing.fee,
        paymentStatus: pricing.paymentStatus,
        selectedSlotId: (dto as any).selectedSlotId || "",
        selectedSlotName:
          (dto as any).selectedSlotName || pricing.slot?.name || "",
        source: dto.source || "external",
        statusHistory: [
          {
            status: "Pending",
            note: pricing.isCharged
              ? `Application submitted for ${pricing.slot?.name || "a paid slot"} (fee ${pricing.fee})`
              : "Application submitted",
            changedAt: new Date(),
            changedBy: dto.source === "organizer" ? "organizer" : "applicant",
          },
        ],
      });

      // Grow the organizer's speaker roster. Best-effort — a profile hiccup
      // must not fail the application itself.
      const profile = await this.upsertSpeakerProfile(dto.organizerId, {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        title: dto.title,
        organization: dto.organization,
        bio: dto.bio,
        expertise: dto.expertise,
        image: (dto as any).image,
        socialLinks: dto.socialLinks as any,
        previousSpeakingExperience: dto.previousSpeakingExperience,
        equipmentNeeded: dto.equipmentNeeded,
      });
      if (profile?._id) {
        (request as any).speakerId = profile._id;
        await request.save();
      }

      const populated = await request.populate([
        { path: "eventId", select: "title location startDate time endTime" },
        {
          path: "organizerId",
          select: "name email organizationName whatsAppNumber",
        },
      ]);

      // Send WhatsApp to speaker
      await this.sendWhatsAppNotification(
        dto.phone,
        `🎤 *Speaker Application Submitted*\n\n` +
          `Dear ${dto.name},\n\n` +
          `Your speaker application for *${event.title}* has been submitted successfully.\n\n` +
          `📋 *Event:* ${event.title}\n` +
          `📍 *Location:* ${event.location || "TBD"}\n` +
          `📅 *Date:* ${new Date(event.startDate).toLocaleDateString()}\n\n` +
          `Your application is now pending organizer approval.\n` +
          `You will receive a notification once it's reviewed.\n\n` +
          `Thank you! 🙏`,
      );

      // Email is the primary channel (WhatsApp is being retired): tell the
      // speaker their request is pending, and set the expectation for what
      // happens after approval — free slots issue the pass straight away,
      // paid slots need them to sign back in and pay.
      await this.sendSpeakerEmail({
        to: request.email,
        organizerId: dto.organizerId,
        subject: `Speaker application received — ${event.title}`,
        heading: "Your application is pending approval",
        accent: "linear-gradient(135deg,#f59e0b,#d97706)",
        bodyHtml: `
          <p style="margin:0 0 12px">Hi ${request.name},</p>
          <p style="margin:0 0 12px">Thanks for applying to speak. Your application is now with the organizer for review.</p>
          ${this.speakerSummaryHtml(request, event, pricing.fee)}
          <p style="margin:12px 0 0;color:#475569">
            ${
              pricing.isCharged
                ? `Once approved, sign back in on the event page with this same email to pay the ${pricing.fee} slot fee. Your speaker pass with QR code is issued after the organizer confirms your payment.`
                : `This slot is free — once the organizer approves you, your speaker pass with QR code arrives by email automatically.`
            }
          </p>`,
      });

      // Let the organizer know something is waiting for them.
      const organizerDoc: any = populated.organizerId;
      await this.sendSpeakerEmail({
        to: organizerDoc?.email,
        organizerId: dto.organizerId,
        subject: `New speaker application — ${event.title}`,
        heading: "New speaker application",
        bodyHtml: `
          <p style="margin:0 0 12px"><strong>${request.name}</strong>${
            request.organization ? ` (${request.organization})` : ""
          } applied to speak at <strong>${event.title}</strong>.</p>
          ${this.speakerSummaryHtml(request, event, pricing.fee)}
          <p style="margin:12px 0 0;color:#475569">Review it from the Speakers tab in your dashboard.</p>`,
      });

      return {
        success: true,
        message: "Speaker application submitted successfully",
        data: populated,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;
      this.logger.error("Error creating speaker request:", error);
      throw new BadRequestException(error.message);
    }
  }

  // ============ PHASE 2: UPDATE STATUS (APPROVE / REJECT / CANCEL) ============
  async updateStatus(id: string, dto: UpdateSpeakerRequestStatusDto) {
    try {
      if (!Types.ObjectId.isValid(id))
        throw new BadRequestException("Invalid ID");

      const request = await this.speakerRequestModel
        .findById(id)
        .populate("eventId")
        .populate("organizerId");
      if (!request) throw new NotFoundException("Speaker request not found");

      const updateData: any = {
        status: dto.status,
        $push: {
          statusHistory: {
            status: dto.status,
            note:
              dto.notes ||
              (dto.status === "Confirmed"
                ? "Application approved"
                : dto.status === "Rejected"
                  ? `Application rejected${dto.rejectionReason ? `: ${dto.rejectionReason}` : ""}`
                  : `Status changed to ${dto.status}`),
            changedAt: new Date(),
            // The operator's name, or "Organizer" for the account owner.
            changedBy: dto.changedBy || "Organizer",
          },
        },
      };

      if (dto.status === "Confirmed") {
        updateData.confirmationDate = new Date();
      }

      if (dto.status === "Rejected") {
        updateData.rejectionDate = new Date();
        updateData.organizerNotes = dto.rejectionReason || dto.notes;
      }

      const updated = await this.speakerRequestModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .populate([
          { path: "eventId", select: "title location startDate time endTime" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      const event: any = updated.eventId;

      // ===== APPROVAL FORKS ON THE SLOT FEE =====
      // Free slot  → nothing left to collect, so issue the pass immediately
      //              and the speaker's next email IS their QR ticket.
      // Paid slot  → approval only unlocks payment. The speaker signs back in
      //              with the same email, pays, and the pass is issued when
      //              the organizer confirms that payment (see confirmPayment).
      // This mirrors the stall flow exactly.
      if (dto.status === "Confirmed") {
        const fee = Number(updated.fee) || 0;
        const isPaidSlot = !!updated.isCharged && fee > 0;

        await this.sendWhatsAppNotification(
          request.phone,
          `✅ *Speaker Application Approved!*\n\n` +
            `Congratulations ${request.name}!\n\n` +
            `Your speaker application for *${event?.title}* has been approved.\n\n` +
            (isPaidSlot
              ? `💳 *Next step:* sign in on the event page with the same email and pay the slot fee of ${fee}. Your speaker pass follows once the organizer confirms the payment.`
              : `🎟️ Your speaker pass with QR code is on its way by email.`),
        );

        if (isPaidSlot) {
          await this.sendSpeakerEmail({
            to: updated.email,
            organizerId: updated.organizerId,
            subject: `Approved — payment required for ${event?.title}`,
            heading: "You're approved! One step left",
            accent: "linear-gradient(135deg,#3b82f6,#6366f1)",
            bodyHtml: `
              <p style="margin:0 0 12px">Hi ${updated.name},</p>
              <p style="margin:0 0 12px">Great news — the organizer approved your speaker application.</p>
              ${this.speakerSummaryHtml(updated, event, fee)}
              <p style="margin:12px 0 12px"><strong>To confirm your slot, pay the fee of ${fee}.</strong></p>
              <p style="margin:0 0 12px;color:#475569">Open the event page, choose <em>Apply as Speaker</em> and sign in with <strong>${updated.email}</strong> — the same address you applied with. Your application will be waiting with a payment option.</p>
              <p style="margin:0;color:#475569">Your speaker pass with QR code is issued as soon as the organizer confirms your payment.</p>`,
          });
        } else {
          // Free slot: issue the pass right now. Reuses the same generator the
          // paid path runs after payment confirmation, so both routes produce
          // an identical pass and a Completed request.
          try {
            await this.issueSpeakerPass(
              String(updated._id),
              `Approved by ${dto.changedBy || "Organizer"} — free slot, pass issued automatically.`,
              dto.changedBy || "Organizer",
            );
          } catch (passErr) {
            this.logger.error(
              `Auto-issue of speaker pass failed for ${updated._id}: ${
                (passErr as any)?.message || passErr
              }`,
            );
          }
        }
      } else if (dto.status === "Rejected") {
        await this.sendWhatsAppNotification(
          request.phone,
          `❌ *Speaker Application Update*\n\n` +
            `Dear ${request.name},\n\n` +
            `Your speaker application for *${event?.title}* was not selected.\n\n` +
            `${dto.rejectionReason ? `Reason: ${dto.rejectionReason}\n\n` : ""}` +
            `Please contact the organizer for more information.\n` +
            `Thank you for your interest. 🙏`,
        );
        await this.sendSpeakerEmail({
          to: updated.email,
          organizerId: updated.organizerId,
          subject: `Update on your speaker application — ${event?.title}`,
          heading: "Application update",
          accent: "linear-gradient(135deg,#64748b,#475569)",
          bodyHtml: `
            <p style="margin:0 0 12px">Hi ${updated.name},</p>
            <p style="margin:0 0 12px">Thank you for your interest in speaking at <strong>${event?.title}</strong>. On this occasion your application wasn't selected.</p>
            ${dto.rejectionReason ? `<p style="margin:0 0 12px"><strong>Reason:</strong> ${dto.rejectionReason}</p>` : ""}
            <p style="margin:0;color:#475569">You're welcome to apply to future events — your speaker profile is saved, so it'll only take a moment.</p>`,
        });
      } else if (dto.status === "Cancelled") {
        await this.sendWhatsAppNotification(
          request.phone,
          `⚠️ *Speaker Slot Cancelled*\n\n` +
            `Dear ${request.name},\n\n` +
            `Your speaker slot for *${event?.title}* has been cancelled.\n\n` +
            `Please contact the organizer for more details.`,
        );
      }

      return {
        success: true,
        message: `Speaker request ${dto.status.toLowerCase()} successfully`,
        data: updated,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new BadRequestException(error.message);
    }
  }

  // ============ PHASE 2b: SELECT TIME SLOT (After approval) ============
  async selectTimeSlot(id: string, dto: ConfirmSessionTimesDto) {
    try {
      const request = await this.speakerRequestModel
        .findById(id)
        .populate("eventId");
      if (!request) throw new NotFoundException("Speaker request not found");

      if (request.status !== "Confirmed") {
        throw new BadRequestException(
          "Speaker must be approved before selecting a time slot",
        );
      }

      request.sessions = dto.sessions.map((s) => ({
        topic: s.topic,
        description: s.description,
        confirmedStartTime: s.confirmedStartTime,
        confirmedEndTime: s.confirmedEndTime,
      }));

      request.status = "Processing";
      request.statusHistory.push({
        status: "Processing" as any,
        note: "Time slot selected, pending payment",
        changedAt: new Date(),
        changedBy: "speaker",
      });

      await request.save();

      const event: any = request.eventId;
      await this.sendWhatsAppNotification(
        request.phone,
        `📅 *Time Slot Selected*\n\n` +
          `Dear ${request.name},\n\n` +
          `Your session for *${event?.title}* has been scheduled.\n\n` +
          `📋 *Session Details:*\n` +
          dto.sessions
            .map(
              (s) =>
                `• ${s.topic}: ${s.confirmedStartTime} - ${s.confirmedEndTime}`,
            )
            .join("\n") +
          `\n\n${request.isCharged && request.fee > 0 ? `💰 Payment of ${request.fee} is required to confirm.\n\n` : "✅ This is a free session slot - no payment required.\n\n"}` +
          `Thank you! 🎤`,
      );

      return {
        success: true,
        message: "Time slot selected successfully",
        data: request,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new BadRequestException(error.message);
    }
  }

  // ============ SET FEE ============
  async updateFee(id: string, dto: UpdateSpeakerFeeDto) {
    try {
      const request = await this.speakerRequestModel.findById(id);
      if (!request) throw new NotFoundException("Speaker request not found");

      request.isCharged = dto.isCharged;
      request.fee = dto.isCharged ? dto.fee || 0 : 0;
      request.paymentStatus = dto.isCharged ? "Unpaid" : "Waived";
      if (dto.notes) request.organizerNotes = dto.notes;

      await request.save();

      return {
        success: true,
        message: dto.isCharged
          ? `Fee of ${dto.fee} set for speaker`
          : "Speaker slot marked as free",
        data: request,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // ============ PHASE 3: CONFIRM PAYMENT → GENERATE QR + PDF ============
  /**
   * Organizer confirms a paid slot's payment. Marks it Paid, then hands off to
   * the shared pass issuer — so a paid speaker ends up in exactly the state a
   * free (auto-approved) speaker does.
   */
  async confirmPayment(id: string, notes?: string, changedBy?: string) {
    try {
      if (!Types.ObjectId.isValid(id))
        throw new BadRequestException("Invalid ID");

      const request = await this.speakerRequestModel.findById(id);
      if (!request) throw new NotFoundException("Speaker request not found");

      request.paymentStatus = "Paid";
      request.paymentDate = new Date();
      await request.save();

      return await this.issueSpeakerPass(
        id,
        notes || "Payment confirmed. Speaker pass issued.",
        changedBy,
      );
    } catch (error) {
      this.logger.error("Error confirming speaker payment:", error);
      throw error;
    }
  }

  /**
   * Issue the speaker pass and deliver it.
   *
   * The single exit both approval routes funnel into:
   *   • free slot  → called straight from updateStatus on approval
   *   • paid slot  → called from confirmPayment once the money is in
   * so the pass, the QR payload and the email are identical either way.
   *
   * The QR payload is persisted BEFORE the PDF is rendered. Rendering needs
   * headless Chromium and fails for environmental reasons (a read-only /tmp,
   * a missing browser); when it does, the speaker loses an attachment but
   * stays scannable at the gate, and re-sending attaches the PDF once the
   * render is healthy again. Same rule as the stall tickets.
   */
  private async issueSpeakerPass(
    id: string,
    note?: string,
    changedBy?: string,
  ) {
    const request = await this.speakerRequestModel
      .findById(id)
      .populate("eventId")
      .populate("organizerId");
    if (!request) throw new NotFoundException("Speaker request not found");

    const event: any = request.eventId;

    const qrPayload = {
      warning: "❌ Normal scanners not allowed. Please use the EventSH app.",
      type: "eventsh-speaker-checkin",
      speakerRequestId: id,
      eventId: (event as any)._id.toString(),
      speakerName: request.name,
      issuedAt: new Date().toISOString(),
    };
    const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 200,
      margin: 2,
    });

    // Scannable first, pretty second.
    request.status = "Completed";
    request.qrCodeData = JSON.stringify(qrPayload);
    (request as any).qrCodeImage = qrCodeBase64;
    request.qrCodePath = null;
    request.statusHistory.push({
      status: "Completed" as any,
      note: note || "Speaker pass issued.",
      changedAt: new Date(),
      // Named actor when a person triggered this (payment confirmation);
      // "System" when it fired automatically off a free-slot approval.
      changedBy: changedBy || "System",
    });
    await request.save();

    // Publish onto the event's speaker line-up (eventfront carousel + tab).
    await this.addSpeakerToEvent(request);
    // Keep the roster's confirmed count honest.
    if ((request as any).speakerId) {
      await this.speakerModel
        .updateOne(
          { _id: (request as any).speakerId },
          { $inc: { confirmedSessions: 1 } },
        )
        .catch(() => undefined);
    }

    let pdfPath: string | null = null;
    try {
      const pdfBuffer = await this.generateSpeakerTicketPDF(
        request,
        qrCodeBase64,
      );
      const pdfDir = path.join(process.cwd(), "uploads", "speakerTickets");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFileName = `speaker_pass_${id}.pdf`;
      pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);
      request.qrCodePath = `/uploads/speakerTickets/${pdfFileName}`;
      await request.save();
    } catch (pdfErr) {
      pdfPath = null;
      this.logger.error(
        `Speaker pass PDF render failed for ${id}: ${
          (pdfErr as any)?.message || pdfErr
        }. The QR payload is stored, so the speaker stays scannable.`,
      );
    }

    const eventDate = event?.startDate
      ? new Date(event.startDate).toLocaleDateString()
      : "TBA";

    await this.sendWhatsAppNotification(
      request.phone,
      `🎉 *Your Speaker Pass is Ready!*\n\n` +
        `🎤 *Speaker:* ${request.name}\n` +
        `📅 *Event:* ${event?.title}\n` +
        `📍 *Date:* ${eventDate}\n` +
        `📍 *Venue:* ${event?.location || "TBD"}\n\n` +
        `⚠️ The QR code can ONLY be scanned using the official EventSH app.\n\n` +
        `Thank you for speaking at our event! 🎊`,
    );

    // Email is the pass's real home. Attach the PDF when we have one;
    // otherwise embed the QR itself so the speaker is never left without a
    // way in.
    const qrPng = Buffer.from(qrCodeBase64.split(",")[1] || "", "base64");
    await this.sendSpeakerEmail({
      to: request.email,
      organizerId: request.organizerId,
      subject: `Your speaker pass for ${event?.title}`,
      heading: "Your speaker pass is ready 🎤",
      accent: "linear-gradient(135deg,#22c55e,#16a34a)",
      bodyHtml: `
          <p style="margin:0 0 12px">Hi ${request.name},</p>
          <p style="margin:0 0 12px">You're all set — your slot is confirmed.</p>
          ${this.speakerSummaryHtml(request, event)}
          ${
            pdfPath
              ? `<p style="margin:12px 0 0">Your speaker pass is attached as a PDF. Present the QR code at the entrance.</p>`
              : `<div style="text-align:center;padding:8px 0">
                   <img src="cid:speakerqr" alt="Speaker check-in QR" style="width:200px;height:200px"/>
                   <p style="color:#64748b;font-size:12px;margin:8px 0 0">Show this QR at the entrance. It's also attached as an image.</p>
                 </div>`
          }
          <p style="margin:12px 0 0;color:#64748b;font-size:12px">The QR code can only be scanned by the official EventSH app.</p>`,
      attachments: pdfPath
        ? [{ filename: "speaker-pass.pdf", content: fs.readFileSync(pdfPath) }]
        : [
            {
              filename: "speaker-qr.png",
              content: qrPng,
              cid: "speakerqr",
            },
          ],
    });

    return {
      success: true,
      message: pdfPath
        ? "Speaker pass issued and emailed."
        : "Speaker pass issued. The PDF couldn't be rendered on this server, so the QR was emailed inline.",
      data: request,
    };
  }

  // ============ QR SCAN - CHECK-IN / CHECK-OUT ============
  async scanSpeakerQR(qrCodeData: string) {
    try {
      const qrData = JSON.parse(qrCodeData);

      if (qrData.type !== "eventsh-speaker-checkin") {
        throw new BadRequestException("Invalid QR code type");
      }

      const request = await this.speakerRequestModel
        .findById(qrData.speakerRequestId)
        .populate("eventId");
      if (!request) throw new NotFoundException("Speaker pass not found");

      const storedQr = JSON.parse(request.qrCodeData || "{}");
      if (storedQr.speakerRequestId !== qrData.speakerRequestId) {
        throw new BadRequestException("Invalid QR code");
      }

      const now = new Date();

      // First scan - Check-in
      if (!request.hasCheckedIn) {
        request.checkInTime = now;
        request.hasCheckedIn = true;
        await request.save();

        await this.sendWhatsAppNotification(
          request.phone,
          `✅ *Check-in Successful*\n\n` +
            `Welcome ${request.name}!\n` +
            `Check-in time: ${now.toLocaleString()}\n\n` +
            `Your session is confirmed. Have a great presentation! 🎤`,
        );

        return {
          success: true,
          message: "Speaker check-in successful",
          data: {
            action: "CHECK_IN",
            speakerName: request.name,
            checkInTime: now,
            sessions: request.sessions,
          },
        };
      }

      // Second scan - Check-out
      if (request.hasCheckedIn && !request.hasCheckedOut) {
        request.checkOutTime = now;
        request.hasCheckedOut = true;
        await request.save();

        const duration = Math.floor(
          (now.getTime() - request.checkInTime.getTime()) / (1000 * 60),
        );

        await this.sendWhatsAppNotification(
          request.phone,
          `👋 *Check-out Successful*\n\n` +
            `Thank you ${request.name}!\n` +
            `Check-out: ${now.toLocaleString()}\n` +
            `Duration: ${duration} minutes\n\n` +
            `Thank you for your amazing session! 🙏`,
        );

        // Speaker feedback link follow-up.
        await this.feedbackService.notifyAfterCheckout({
          audience: "speaker",
          subjectId: String(request._id),
          eventId: String((request as any).eventId),
          whatsAppNumber: request.phone,
          hasDeposit: !!(request as any).depositAmount,
        });

        return {
          success: true,
          message: "Speaker check-out successful",
          data: {
            action: "CHECK_OUT",
            speakerName: request.name,
            checkInTime: request.checkInTime,
            checkOutTime: now,
            duration,
          },
        };
      }

      throw new BadRequestException("Speaker has already checked out");
    } catch (error) {
      this.logger.error("Error scanning speaker QR:", error);
      throw error;
    }
  }

  // ============ DOWNLOAD SPEAKER PASS ============
  async downloadSpeakerPass(id: string) {
    try {
      const request = await this.speakerRequestModel
        .findById(id)
        .populate("eventId")
        .populate("organizerId");
      if (!request) throw new NotFoundException("Speaker request not found");

      if (
        request.paymentStatus !== "Paid" &&
        request.paymentStatus !== "Waived"
      ) {
        throw new BadRequestException(
          "Speaker pass only available after payment confirmation",
        );
      }

      if (request.status !== "Completed") {
        throw new BadRequestException(
          "Speaker pass only available after completion",
        );
      }

      const pdfFileName = `speaker_pass_${id}.pdf`;
      const pdfDir = path.join(process.cwd(), "uploads", "speakerTickets");
      const pdfPath = path.join(pdfDir, pdfFileName);

      if (fs.existsSync(pdfPath)) {
        const buffer = await fs.promises.readFile(pdfPath);
        return { buffer, filename: pdfFileName };
      }

      // Regenerate if missing
      const qrPayload = request.qrCodeData
        ? JSON.parse(request.qrCodeData)
        : { type: "eventsh-speaker-checkin", speakerRequestId: id };

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200,
        margin: 2,
      });
      const pdfBuffer = await this.generateSpeakerTicketPDF(
        request,
        qrCodeBase64,
      );

      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      await fs.promises.writeFile(pdfPath, pdfBuffer);

      return { buffer: pdfBuffer, filename: pdfFileName };
    } catch (error) {
      this.logger.error("Error downloading speaker pass:", error);
      throw error;
    }
  }

  // ============ QUERIES ============
  async findByEvent(eventId: string) {
    const requests = await this.speakerRequestModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .populate([
        { path: "eventId", select: "title location startDate time endTime" },
        { path: "organizerId", select: "name email organizationName" },
      ])
      .sort({ createdAt: -1 });
    return { success: true, data: requests };
  }

  async findByOrganizer(organizerId: string) {
    const requests = await this.speakerRequestModel
      .find({ organizerId: new Types.ObjectId(organizerId) })
      .populate([{ path: "eventId", select: "title location startDate" }])
      .sort({ createdAt: -1 });
    return { success: true, data: requests };
  }

  async findOne(id: string) {
    const request = await this.speakerRequestModel.findById(id).populate([
      { path: "eventId", select: "title location startDate time endTime" },
      { path: "organizerId", select: "name email organizationName" },
    ]);
    if (!request) throw new NotFoundException("Speaker request not found");
    return { success: true, data: request };
  }

  async checkExisting(eventId: string, email: string) {
    const existing = await this.speakerRequestModel.findOne({
      eventId: new Types.ObjectId(eventId),
      email,
      status: { $nin: ["Cancelled", "Rejected"] },
    });
    return { success: true, exists: !!existing, data: existing };
  }

  async getStats(organizerId: string) {
    const requests = await this.speakerRequestModel.find({
      organizerId: new Types.ObjectId(organizerId),
    });
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === "Pending").length,
      confirmed: requests.filter((r) => r.status === "Confirmed").length,
      processing: requests.filter((r) => r.status === "Processing").length,
      completed: requests.filter((r) => r.status === "Completed").length,
      rejected: requests.filter((r) => r.status === "Rejected").length,
      totalRevenue: requests
        .filter((r) => r.paymentStatus === "Paid")
        .reduce((sum, r) => sum + r.fee, 0),
    };
  }

  async getAttendance(id: string) {
    const request = await this.speakerRequestModel
      .findById(id)
      .select(
        "name checkInTime checkOutTime hasCheckedIn hasCheckedOut sessions",
      );
    if (!request) throw new NotFoundException("Speaker request not found");
    return {
      success: true,
      data: {
        name: request.name,
        checkInTime: request.checkInTime,
        checkOutTime: request.checkOutTime,
        hasCheckedIn: request.hasCheckedIn,
        hasCheckedOut: request.hasCheckedOut,
      },
    };
  }

  async updatePaymentStatus(id: string, paymentStatus: string, notes?: string) {
    const request = await this.speakerRequestModel.findById(id);
    if (!request) throw new NotFoundException("Speaker request not found");

    if (paymentStatus === "Paid") {
      // No speaker payments once the event has ended.
      const ev = await this.eventModel.findById(request.eventId);
      if (eventHasEnded(ev as any)) {
        throw new BadRequestException(EVENT_ENDED_MESSAGE);
      }
      return this.confirmPayment(id, notes);
    }

    request.paymentStatus = paymentStatus;
    request.statusHistory.push({
      status: request.status as any,
      note: notes || `Payment status changed to ${paymentStatus}`,
      changedAt: new Date(),
      changedBy: "organizer",
    });
    await request.save();

    return { success: true, message: "Payment status updated", data: request };
  }

  // Generate pass for organizer-added speaker (no application flow needed)
  async generatePassForEventSpeaker(eventId: string, speaker: any) {
    try {
      const event = await this.eventModel.findById(eventId);
      if (!event) throw new NotFoundException("Event not found");

      // Check if a request already exists for this speaker
      let request = await this.speakerRequestModel.findOne({
        eventId: new Types.ObjectId(eventId),
        name: speaker.name,
        source: "organizer",
      });

      if (request && request.qrCodePath) {
        return { success: true, message: "Pass already exists", data: request };
      }

      if (!request) {
        request = await this.speakerRequestModel.create({
          eventId: new Types.ObjectId(eventId),
          organizerId: event.organizer,
          name: speaker.name,
          email: speaker.email || "",
          phone: speaker.whatsAppNumber || "",
          title: speaker.title || speaker.agenda || "",
          organization: speaker.companyName || speaker.organization || "",
          bio: speaker.bio || speaker.description || "",
          socialLinks: speaker.socialLinks || {},
          sessions: (speaker.slots || speaker.sessions || []).map((s: any) => ({
            topic: s.topic || s.agenda || speaker.name,
            confirmedStartTime: s.startTime || s.confirmedStartTime || "",
            confirmedEndTime: s.endTime || s.confirmedEndTime || "",
            description: s.description || "",
          })),
          status: "Completed",
          paymentStatus: "Waived",
          source: "organizer",
          isKeynote: speaker.isKeynote || false,
          statusHistory: [
            {
              status: "Completed",
              note: "Added by organizer, pass auto-generated",
              changedAt: new Date(),
              changedBy: "organizer",
            },
          ],
        });
      }

      // Generate QR
      const qrPayload = {
        warning: "Use EventSH app to scan.",
        type: "eventsh-speaker-checkin",
        speakerRequestId: request._id.toString(),
        eventId,
        speakerName: speaker.name,
        issuedAt: new Date().toISOString(),
      };

      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200,
        margin: 2,
      });

      // Scannable record first, PDF second — and keep the field contract:
      // qrCodeData = payload, qrCodeImage = the QR, qrCodePath = the PDF url
      // (never base64). A render failure then costs an attachment, not the
      // ability to check this speaker in.
      request.qrCodeData = JSON.stringify(qrPayload);
      (request as any).qrCodeImage = qrCodeBase64;
      request.qrCodePath = null;
      request.status = "Completed";
      await request.save();

      // Generate PDF
      const pdfDir = path.join(process.cwd(), "uploads", "speakerTickets");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFileName = `speaker_pass_${request._id}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);
      try {
        const pdfBuffer = await this.generateSpeakerTicketPDF(
          request,
          qrCodeBase64,
        );
        await fs.promises.writeFile(pdfPath, pdfBuffer);
        request.qrCodePath = `/uploads/speakerTickets/${pdfFileName}`;
        await request.save();
      } catch (pdfErr) {
        this.logger.error(
          `Speaker pass PDF render failed for ${request._id}: ${
            (pdfErr as any)?.message || pdfErr
          }. The QR payload is stored, so the speaker stays scannable.`,
        );
      }

      return {
        success: true,
        message: "Speaker pass generated",
        data: request,
      };
    } catch (error) {
      this.logger.error("Error generating pass for event speaker:", error);
      throw error;
    }
  }

  async remove(id: string) {
    const request = await this.speakerRequestModel.findByIdAndDelete(id);
    if (!request) throw new NotFoundException("Speaker request not found");
    return { success: true, message: "Speaker request deleted" };
  }

  // ============ PRIVATE: PDF GENERATION ============
  /**
   * The organizer's brand for the pass header — their organisation name, the
   * same rule the visitor ticket uses. Works whether organizerId arrives
   * populated (issueSpeakerPass populates it) or as a bare id (the older
   * generate/download paths don't), so the pass is never mis-branded just
   * because of how it was loaded.
   */
  private async resolveOrgName(request: any): Promise<string> {
    const org: any = request?.organizerId;
    if (org && typeof org === "object" && (org.organizationName || org.name)) {
      return org.organizationName || org.name;
    }
    const id = org?._id || org;
    if (id) {
      try {
        const doc: any = await this.organizerModel
          .findById(id)
          .select("organizationName name")
          .lean();
        if (doc) return doc.organizationName || doc.name || "EventSH";
      } catch {
        // fall through to the platform default
      }
    }
    return "EventSH";
  }

  private async generateSpeakerTicketPDF(
    request: any,
    qrBase64: string,
  ): Promise<Buffer> {
    const event: any = request.eventId;
    const eventDate = new Date(event?.startDate).toLocaleDateString();
    // Organizer brands the pass; "Powered by EventSH" stays in the footer.
    const orgName = await this.resolveOrgName(request);

    const html = `<!DOCTYPE html>
<html><head><style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 15px; background: #f5f5f5; font-size: 11px; }
  .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { text-align: center; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #7c3aed; margin: 0; }
  .header p { color: #666; margin: 5px 0 0; }
  .event-title { font-size: 20px; font-weight: bold; margin: 15px 0; text-align: center; }
  .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 11px; }
  .section-title { font-size: 12px; color: #7c3aed; font-weight: bold; text-transform: uppercase; margin: 15px 0 8px; border-bottom: 2px solid #7c3aed; display: inline-block; }
  .qr-section { text-align: center; margin: 20px 0; }
  .qr-section img { width: 180px; height: 180px; }
  .session-item { background: #f8f5ff; padding: 8px; border-radius: 6px; margin: 5px 0; border-left: 3px solid #7c3aed; }
  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; font-size: 10px; color: #856404; }
  .footer { text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; margin-top: 15px; }
</style></head>
<body><div class="container">
  <div class="header">
    <h1>${String(orgName).toUpperCase()} SPEAKER PASS</h1>
    <p>Your speaking session has been confirmed</p>
  </div>
  <div class="event-title">${event?.title || "Event"}</div>
  <div class="section-title">Speaker Details</div>
  <div class="detail-row"><span>Name:</span><span>${request.name}</span></div>
  ${request.title ? `<div class="detail-row"><span>Role:</span><span>${request.title}</span></div>` : ""}
  ${request.organization ? `<div class="detail-row"><span>Organization:</span><span>${request.organization}</span></div>` : ""}
  ${request.email ? `<div class="detail-row"><span>Email:</span><span>${request.email}</span></div>` : ""}
  <div class="section-title">Event Information</div>
  <div class="detail-row"><span>📅 Date:</span><span>${eventDate}</span></div>
  <div class="detail-row"><span>📍 Venue:</span><span>${event?.location || "TBD"}</span></div>
  ${
    (request.sessions || []).length > 0
      ? `
    <div class="section-title">Sessions</div>
    ${request.sessions
      .map(
        (s: any) => `
      <div class="session-item">
        <strong>${s.topic}</strong><br>
        ${s.confirmedStartTime || s.preferredStartTime ? `Time: ${s.confirmedStartTime || s.preferredStartTime} - ${s.confirmedEndTime || s.preferredEndTime}` : ""}
        ${s.description ? `<br><small>${s.description}</small>` : ""}
      </div>
    `,
      )
      .join("")}
  `
      : ""
  }
  <div class="qr-section">
    <p style="font-weight:bold; color:#7c3aed; font-size:14px;">Your Speaker QR Code</p>
    <p style="font-size:10px; color:#666;">Scan at Event Entrance</p>
    <img src="${qrBase64}" alt="Speaker QR Code">
  </div>
  <div class="warning">⚠️ <strong>Important:</strong> Use the official EventSH App to scan QR code for Check-In and Check-Out.</div>
  <div class="footer">© ${new Date().getFullYear()} ${orgName} · Powered by EventSH</div>
</div></body></html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    await browser.close();
    return Buffer.from(pdfUint8);
  }

  // ============ PRIVATE: ADD SPEAKER TO EVENT ============
  private async addSpeakerToEvent(request: SpeakerRequestDocument) {
    try {
      const event = await this.eventModel.findById(request.eventId);
      if (!event) return;

      const speakers = event.speakers || [];
      const filtered = speakers.filter(
        (s: any) => s.requestId !== request._id.toString(),
      );

      const slots = (request.sessions || []).map((s: any) => ({
        topic: s.topic,
        startTime: s.confirmedStartTime || s.preferredStartTime || "",
        endTime: s.confirmedEndTime || s.preferredEndTime || "",
        description: s.description || "",
      }));

      filtered.push({
        id: `req-${request._id}`,
        requestId: request._id.toString(),
        name: request.name,
        title: request.title || "",
        organization: request.organization || "",
        bio: request.bio || "",
        image: request.image || "",
        email: request.email || "",
        socialLinks: request.socialLinks || {},
        slots,
        isKeynote: request.isKeynote || false,
        order: filtered.length,
      });

      await this.eventModel.findByIdAndUpdate(request.eventId, {
        speakers: filtered,
      });
    } catch (error) {
      this.logger.error("Error adding speaker to event:", error);
    }
  }

  // ============ PRIVATE: WHATSAPP HELPER ============
  private async sendWhatsAppNotification(phone: string, message: string) {
    if (!phone) return;
    try {
      await this.otpService.sendWhatsAppMessage(phone, message);
    } catch (err) {
      this.logger.warn("WhatsApp notification failed:", err);
    }
  }
}
