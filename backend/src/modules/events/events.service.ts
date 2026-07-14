import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { OAuth2Client } from "google-auth-library";
import { Event, EventDocument } from "./schemas/event.schema";
import { CreateEventDto } from "./dto/createEvent.dto";
import { UpdateEventDto } from "./dto/updateEvent.dto";
import { TemplatesService } from "../templates/templates.service";
import { OtpService } from "../otp/otp.service";

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly templatesService: TemplatesService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
  ) {}

  // Email-OTP gate for volunteer sign-in on the scanner page. Two steps:
  //   1) sendVolunteerOtp: refuse early if the email isn't on the event's
  //      volunteer list, so we don't email random people OTP codes.
  //   2) verifyVolunteerOtp: confirm the OTP, then re-check the allow-list
  //      (the list could have changed between send and verify).
  // Uses the existing OtpService email channel under role="volunteer" to
  // namespace away from other email-OTP flows.
  async sendVolunteerOtp(eventId: string, email: string) {
    if (!email) {
      throw new BadRequestException("Email is required");
    }
    const event: any = await this.eventModel.findById(eventId).lean();
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    const normalized = email.trim().toLowerCase();
    const isVolunteer = (event.volunteers || []).some(
      (v: any) => (v.email || "").toLowerCase() === normalized,
    );
    if (!isVolunteer) {
      throw new ForbiddenException(
        "This email isn't on the volunteer list for this event.",
      );
    }
    await this.otpService.sendOtp(normalized, "volunteer");
    return { message: "OTP sent to your email" };
  }

  async verifyVolunteerOtp(eventId: string, email: string, otp: string) {
    if (!email || !otp) {
      throw new BadRequestException("Email and OTP are required");
    }
    const normalized = email.trim().toLowerCase();
    await this.otpService.verifyOtp(normalized, "volunteer", otp);
    const event: any = await this.eventModel.findById(eventId).lean();
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    const volunteer = (event.volunteers || []).find(
      (v: any) => (v.email || "").toLowerCase() === normalized,
    );
    if (!volunteer) {
      throw new ForbiddenException(
        "This email isn't on the volunteer list for this event.",
      );
    }
    return {
      volunteer: {
        name: volunteer.name,
        email: volunteer.email,
        phoneNumber: volunteer.phoneNumber,
      },
    };
  }

  // Google-Auth gate for volunteer sign-in. The volunteer signs in with Google
  // on the scanner page; we verify the id_token Google issued, then confirm the
  // verified Gmail is on this event's volunteer allow-list. Only whitelisted
  // Gmail IDs (the ones the organizer added) can get in — no password, no OTP.
  async verifyVolunteerGoogle(eventId: string, credential: string) {
    if (!credential) {
      throw new BadRequestException("Google credential is required");
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException(
        "Google sign-in is not configured on the server",
      );
    }

    // Verify the id_token's signature + audience against our own client id
    // (same pattern as /auth/google-token-exchange).
    let email = "";
    let emailVerified = false;
    let googleName = "";
    try {
      const oauth2 = new OAuth2Client(clientId);
      const ticket = await oauth2.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const p: any = ticket.getPayload() || {};
      email = (p.email || "").trim();
      emailVerified = !!p.email_verified;
      googleName = p.name || "";
    } catch {
      throw new UnauthorizedException(
        "Google rejected the sign-in. Please try again.",
      );
    }

    if (!email || !emailVerified) {
      throw new UnauthorizedException(
        "Your Google account email could not be verified.",
      );
    }

    const normalized = email.toLowerCase();
    const event: any = await this.eventModel.findById(eventId).lean();
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    const volunteer = (event.volunteers || []).find(
      (v: any) => (v.email || "").toLowerCase() === normalized,
    );
    if (!volunteer) {
      throw new ForbiddenException(
        "This Google account isn't on the volunteer list for this event.",
      );
    }

    return {
      volunteer: {
        name: volunteer.name || googleName,
        email: volunteer.email,
        phoneNumber: volunteer.phoneNumber,
      },
    };
  }

  // ── Volunteer Google sign-in via OAuth redirect ──────────────────────────
  // A redirect flow (rather than the in-browser button) so it works with an
  // Authorized *redirect URI* in Google Cloud — no JavaScript-origin setup —
  // and returns a JWT so the volunteer stays signed in across page refreshes.
  private volunteerGoogleClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_VOLUNTEER_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        "Volunteer Google sign-in is not configured on the server",
      );
    }
    return {
      client: new OAuth2Client(clientId, clientSecret, redirectUri),
      clientId,
    };
  }

  // Build the Google consent URL. eventId travels in `state` so the callback
  // knows which event's volunteer allow-list to validate against.
  buildVolunteerGoogleAuthUrl(eventId: string): string {
    if (!eventId) {
      throw new BadRequestException("eventId is required");
    }
    const { client } = this.volunteerGoogleClient();
    return client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state: eventId,
      prompt: "select_account",
    });
  }

  // Handle the OAuth callback: exchange the code, verify the id_token, confirm
  // the Gmail is on the event's volunteer list, then mint a volunteer JWT.
  async handleVolunteerGoogleRedirect(code: string, state: string) {
    if (!code || !state) {
      throw new BadRequestException("Missing authorization code");
    }
    const eventId = state;
    const { client, clientId } = this.volunteerGoogleClient();

    let email = "";
    let googleName = "";
    let emailVerified = false;
    try {
      const { tokens } = await client.getToken(code);
      if (!tokens?.id_token) {
        throw new Error("Google response had no id_token");
      }
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const p: any = ticket.getPayload() || {};
      email = (p.email || "").trim();
      googleName = p.name || "";
      emailVerified = !!p.email_verified;
    } catch {
      throw new UnauthorizedException(
        "Google rejected the sign-in. Please try again.",
      );
    }

    if (!email || !emailVerified) {
      throw new UnauthorizedException(
        "Your Google account email could not be verified.",
      );
    }

    const normalized = email.toLowerCase();
    const event: any = await this.eventModel.findById(eventId).lean();
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    const volunteer = (event.volunteers || []).find(
      (v: any) => (v.email || "").toLowerCase() === normalized,
    );
    if (!volunteer) {
      // Surfaced as a friendly message by the controller.
      throw new ForbiddenException("not_on_list");
    }

    const name = volunteer.name || googleName;
    const token = this.jwtService.sign({
      sub: eventId,
      eventId,
      email: volunteer.email,
      name,
      roles: ["volunteer"],
    });

    return { token, eventId, name, email: volunteer.email };
  }

  // Resolve the demo organization for a "Try the dashboard" session. Uses the
  // given demo event's organizer, or falls back to any showcase event's org.
  // Only demo/showcase events qualify, so this can't mint a session for a real
  // organization.
  async resolveDemoOrg(eventId?: string): Promise<{
    organizerId: string;
    focusEventId: string | null;
    kind: "personal" | "professional";
    email: string | null;
    orgName: string | null;
  } | null> {
    let ev: any = null;
    if (eventId) {
      ev = await this.eventModel
        .findOne({ _id: eventId, isDemo: true })
        .select("organizer showcaseKind eventType category")
        .lean()
        .catch(() => null);
    }
    if (!ev) {
      ev = await this.eventModel
        .findOne({ isShowcase: true })
        .select("organizer showcaseKind eventType category")
        .sort({ createdAt: -1 })
        .lean();
    }
    if (!ev?.organizer) return null;
    const isPersonal =
      ev.showcaseKind === "personal" ||
      ev.eventType === "personal" ||
      ev.category === "Marriage Function";
    // The individual chatbot resolves "my events" by the account's email, so
    // include the backing organizer's email in the demo token.
    let email: string | null = null;
    let orgName: string | null = null;
    try {
      const org: any = await this.eventModel.db
        .collection("organizers")
        .findOne({ _id: new Types.ObjectId(String(ev.organizer)) });
      email = org?.email || null;
      orgName = org?.organizationName || null;
    } catch {
      // best-effort — falls back to no email (chatbot shows onboarding)
    }
    return {
      organizerId: String(ev.organizer),
      focusEventId: eventId || null,
      kind: isPersonal ? "personal" : "professional",
      email,
      orgName,
    };
  }

  // Admin: update the showcase / demo flags + metadata on an event.
  async setShowcase(id: string, body: any): Promise<Event> {
    const $set: any = {};
    if (body.isShowcase !== undefined) $set.isShowcase = body.isShowcase === true;
    if (body.isDemo !== undefined) $set.isDemo = body.isDemo === true;
    if (body.showcaseKind !== undefined) $set.showcaseKind = body.showcaseKind;
    if (body.showcaseMode !== undefined) $set.showcaseMode = body.showcaseMode;
    if (body.showcaseOrder !== undefined)
      $set.showcaseOrder = Number(body.showcaseOrder) || 0;
    if (body.showcaseBlurb !== undefined)
      $set.showcaseBlurb = body.showcaseBlurb;
    return this.eventModel
      .findByIdAndUpdate(id, { $set }, { new: true })
      .exec();
  }

  // Admin-curated demo events for the public landing "See it in action" grid.
  // Returns only the light fields the cards need, newest showcaseOrder first
  // within each kind (professional / personal).
  async getShowcaseEvents(): Promise<any[]> {
    const events = await this.eventModel
      .find({ isShowcase: true })
      .select(
        "title description showcaseKind showcaseMode showcaseBlurb showcaseOrder eventType category image isDemo organizationName organizer",
      )
      .sort({ showcaseKind: 1, showcaseOrder: 1, createdAt: -1 })
      .lean()
      .exec();
    return events || [];
  }

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      const startDate = new Date(createEventDto.startDate);
      const endDate = createEventDto.endDate
        ? new Date(createEventDto.endDate)
        : new Date(createEventDto.startDate);

      // Initial ticket capacity = sum of visitor-type caps when present,
      // otherwise the flat totalTickets. Stored in originalTotalTickets so the
      // front end can always show "available / original" — purchases later
      // decrement the live counts but never this baseline.
      const initialCapacity =
        Array.isArray(createEventDto.visitorTypes) &&
        createEventDto.visitorTypes.length > 0
          ? createEventDto.visitorTypes.reduce(
              (sum: number, v: any) => sum + (Number(v.maxCount) || 0),
              0,
            )
          : Number(createEventDto.totalTickets) || undefined;

      const event = new this.eventModel({
        title: createEventDto.title,
        description: createEventDto.description,
        eventType: createEventDto.eventType,
        // Landing-page showcase / demo flags (admin-created demo events).
        isShowcase: createEventDto.isShowcase === true,
        isDemo: createEventDto.isDemo === true,
        showcaseKind: createEventDto.showcaseKind,
        showcaseMode: createEventDto.showcaseMode || "eventfront",
        showcaseOrder: Number(createEventDto.showcaseOrder) || 0,
        showcaseBlurb: createEventDto.showcaseBlurb,
        category: createEventDto.category,
        startDate,
        time: createEventDto.time,
        endDate,
        endTime: createEventDto.endTime || "",
        organizer: createEventDto.organizerId,
        location: createEventDto.location,
        address: createEventDto.address,
        ticketPrice: createEventDto.ticketPrice,
        totalTickets: initialCapacity,
        originalTotalTickets: initialCapacity,
        visibility: createEventDto.visibility || "public",
        inviteLink: createEventDto.inviteLink,
        tags: createEventDto.tags || [],
        features: createEventDto.features || {
          food: false,
          parking: false,
          wifi: false,
          photography: false,
          security: false,
          accessibility: false,
        },
        ageRestriction: createEventDto.ageRestriction,
        ageRestrictions: createEventDto.ageRestrictions,
        dresscode: createEventDto.dresscode,
        dressCodeTheme: createEventDto.dressCodeTheme,
        specialInstructions: createEventDto.specialInstructions,
        refundPolicy: createEventDto.refundPolicy,
        termsAndConditions: createEventDto.termsAndConditions,
        customSections: createEventDto.customSections || [],
        sectionVisibility: createEventDto.sectionVisibility || {},
        setupTime: createEventDto.setupTime,
        breakdownTime: createEventDto.breakdownTime,
        socialMedia: createEventDto.socialMedia || {
          facebook: "",
          instagram: "",
          twitter: "",
          linkedin: "",
        },
        image: createEventDto.image,
        gallery: createEventDto.gallery || [],
        sponsors: createEventDto.sponsors || [],
        maxSpacesPerVendor:
          createEventDto.maxSpacesPerVendor != null
            ? Number(createEventDto.maxSpacesPerVendor)
            : 1,
        tableTemplates: createEventDto.tableTemplates || [],
        termsAndConditionsforStalls:
          createEventDto.termsAndConditionsforStalls || [],
        venueTables: createEventDto.venueTables || [],
        addOnItems: createEventDto.addOnItems || [],
        visitorTypes: createEventDto.visitorTypes || [],
        speakers: createEventDto.speakers || [],
        speakerSlotTemplates: createEventDto.speakerSlotTemplates || [],
        venueSpeakerZones: createEventDto.venueSpeakerZones || [],

        // IMPORTANT: venueConfig is now an ARRAY
        venueConfig:
          createEventDto.venueConfig && createEventDto.venueConfig.length > 0
            ? createEventDto.venueConfig
            : [
                {
                  venueConfigId: "venueConfig1",
                  width: 800,
                  height: 500,
                  scale: 0.75,
                  gridSize: 20,
                  showGrid: true,
                  hasMainStage: true,
                  totalRows: 3,
                },
              ],

        roundTableTemplates: createEventDto.roundTableTemplates || [],
        venueRoundTables: createEventDto.venueRoundTables || [],
        venueAnnotations: createEventDto.venueAnnotations || [],
        volunteers: (createEventDto.volunteers || []).map((v) => ({
          name: v.name,
          email: (v.email || "").toLowerCase(),
          phoneNumber: v.phoneNumber,
        })),

        functions: createEventDto.functions || [],
        marriage: createEventDto.marriage || undefined,

        status: createEventDto.status || "draft",
        featured: createEventDto.featured || false,
        // Public Eventfront chatbot config. Explicitly included here (unlike
        // adBar/reelLinks) so the toggle + name persist on CREATE, not just on
        // edit. Defaults keep the widget off for events that don't send it.
        chatbot: createEventDto.chatbot || {
          enabled: false,
          name: "Event Assistant",
          accentColor: "#2563eb",
        },
      });

      const savedEvent = await event.save();

      // Mirror this event's space configs into the templates collection so
      // they're available as picks when the organizer creates future events.
      // Fire-and-forget — never block the create on template capture.
      this.templatesService
        .captureSpaceTemplates(
          createEventDto.organizerId,
          createEventDto.tableTemplates,
        )
        .catch(() => {});
      // Also snapshot each venue as a reusable layout template.
      this.templatesService
        .captureVenueLayoutTemplates(createEventDto.organizerId, createEventDto)
        .catch(() => {});

      return savedEvent;
    } catch (error) {
      throw { statusCode: 400, message: error.message || "Event creation failed", validationErrors: error.errors };
    }
  }

  async findAll(page = 1, limit = 50): Promise<{ events: Event[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [events, total] = await Promise.all([
        this.eventModel
          .find()
          .populate("organizer")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.eventModel.countDocuments().exec(),
      ]);
      return { events, total };
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Event> {
    try {
      const event = await this.eventModel
        .findById(id)
        .populate("organizer")
        .exec();

      if (!event) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return event;
    } catch (error) {
      console.error("Error finding event:", error);
      throw error;
    }
  }

  async findByOrganizer(
    organizerId: string,
    publicOnly = false,
  ): Promise<{ events: Event[]; total: number }> {
    try {
      // The organizer's own dashboard fetches every event; the public
      // storefront passes publicOnly so Private events stay hidden. Match
      // on `$ne: "private"` (not `=== "public"`) so legacy events with a
      // missing/blank visibility still show on the storefront.
      const query: any = { organizer: organizerId };
      if (publicOnly) {
        query.visibility = { $ne: "private" };
      }

      const [events, total] = await Promise.all([
        this.eventModel
          .find(query)
          .populate("organizer")
          .sort({ createdAt: -1 })
          .exec(),
        this.eventModel.countDocuments(query).exec(),
      ]);

      return { events, total };
    } catch (error) {
      console.error("Error fetching organizer events:", error);
      throw error;
    }
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid event id: ${id}`);
      }

      // Handle date conversions — guard against invalid date strings so we
      // don't push an "Invalid Date" into a Date field (which throws a cast
      // error during save and surfaces as an opaque 500).
      if (updateEventDto.startDate) {
        const d = new Date(updateEventDto.startDate);
        if (isNaN(d.getTime())) {
          throw new BadRequestException(
            `Invalid start date: "${updateEventDto.startDate}"`,
          );
        }
        updateEventDto.startDate = d as any;
      }
      if (updateEventDto.endDate) {
        const d = new Date(updateEventDto.endDate);
        if (isNaN(d.getTime())) {
          throw new BadRequestException(
            `Invalid end date: "${updateEventDto.endDate}"`,
          );
        }
        updateEventDto.endDate = d as any;
      } else if (updateEventDto.startDate) {
        updateEventDto.endDate = new Date(updateEventDto.startDate) as any;
      }

      // Normalize volunteer emails so the verifyVolunteer lookup matches.
      if (Array.isArray(updateEventDto.volunteers)) {
        updateEventDto.volunteers = updateEventDto.volunteers.map((v) => ({
          name: v.name,
          email: (v.email || "").toLowerCase(),
          phoneNumber: v.phoneNumber,
        }));
      }

      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, updateEventDto, {
          new: true,
          runValidators: true,
        })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      // Capture any space templates touched by this update — covers both
      // newly added templates AND legacy events whose tableTemplates were
      // never previously stored in the templates collection.
      const orgId = (updatedEvent as any).organizer?._id || (updatedEvent as any).organizer;
      const tplSource =
        (updateEventDto as any)?.tableTemplates ??
        (updatedEvent as any)?.tableTemplates;
      this.templatesService
        .captureSpaceTemplates(orgId, tplSource)
        .catch(() => {});
      // Snapshot each venue as a reusable layout template (uses the fully
      // merged saved doc so config + placed stalls are current).
      this.templatesService
        .captureVenueLayoutTemplates(orgId, updatedEvent)
        .catch(() => {});

      return updatedEvent;
    } catch (error: any) {
      console.error("Error updating event:", error);
      // Surface Mongoose validation/cast failures as a clear 400 with the
      // offending field, instead of an opaque 500. Helps the organizer fix
      // the actual problem (e.g. a bad number/enum/date in a venue field).
      if (error?.name === "ValidationError") {
        const details = Object.values(error.errors || {})
          .map((e: any) => e.message)
          .join("; ");
        throw new BadRequestException(
          `Event validation failed: ${details || error.message}`,
        );
      }
      if (error?.name === "CastError") {
        throw new BadRequestException(
          `Invalid value for "${error.path}": ${error.message}`,
        );
      }
      // MongoDB rejects any single document over 16 MB. This usually means
      // images/large data were embedded directly in the event (e.g. base64)
      // instead of uploaded as files. Surface it clearly instead of a 500.
      const msg = String(error?.message || "");
      if (
        error?.name === "RangeError" ||
        error?.code === 10334 || // BSONObjectTooLarge
        /out of range|object to insert too large|document is larger|BSONObjectTooLarge/i.test(
          msg,
        )
      ) {
        throw new BadRequestException(
          "This event is too large to save (over MongoDB's 16 MB per-document limit). " +
            "This is usually caused by images embedded directly in the event (base64) " +
            "instead of being uploaded as files. Please re-upload large images/logos as files and try again.",
        );
      }
      throw error;
    }
  }

  // Lightweight toggle for the My Events "Publish" switch — flips the public
  // visibility of the eventfront link without running the full update flow.
  async setPublished(id: string, published: boolean): Promise<Event> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid event id: ${id}`);
    }
    const updated = await this.eventModel
      .findByIdAndUpdate(id, { published }, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<Event> {
    try {
      const deletedEvent = await this.eventModel
        .findByIdAndDelete(id)
        .populate("organizer")
        .exec();

      if (!deletedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return deletedEvent;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Event> {
    try {
      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return updatedEvent;
    } catch (error) {
      console.error("Error updating event status:", error);
      throw error;
    }
  }

  async searchEvents(query: string): Promise<Event[]> {
    try {
      const searchRegex = new RegExp(query, "i");

      const events = await this.eventModel
        .find({
          $or: [
            { title: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
            { category: { $regex: searchRegex } },
            { location: { $regex: searchRegex } },
            { tags: { $in: [searchRegex] } },
          ],
        })
        .populate("organizer")
        .sort({ createdAt: -1 })
        .exec();

      return events;
    } catch (error) {
      console.error("Error searching events:", error);
      throw error;
    }
  }
}
