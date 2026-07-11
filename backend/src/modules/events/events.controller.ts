import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
  Res,
  ParseIntPipe,
  ValidationPipe,
  ForbiddenException,
} from "@nestjs/common";
import { Response } from "express";
import {
  FileInterceptor,
  FilesInterceptor,
  FileFieldsInterceptor,
} from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { AuthGuard } from "@nestjs/passport";
import { EventsService } from "./events.service";
import { EventImportService } from "./event-import.service";
import { CreateEventDto } from "./dto/createEvent.dto";
import { UpdateEventDto } from "./dto/updateEvent.dto";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { WebpValidationPipe } from "../../seed/parse-webp.pipe";
import { compressEventUploadFiles } from "../../seed/compress-event-images.util";
import { computePlanExpiry } from "../plans/plan-validity.util";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { buildDefaultStorefrontSettings } from "../organizer-stores/default-settings";

function generateFileName(req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  cb(null, filename);
}

// Coerce sectionVisibility to a clean { [key]: boolean } map. A bug let this
// field accumulate stringified copies of itself on every save (growing into
// MEGABYTES of "[object Object],{}…" junk and eventually blowing MongoDB's
// 16MB per-document limit). Restricting it to plain boolean values stops that
// permanently: any array / string / non-boolean garbage collapses to {}.
function sanitizeSectionVisibility(input: any): Record<string, boolean> {
  let v = input;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "boolean") out[k] = val;
  }
  return out;
}

const imageFilter = (req: any, file: any, cb: any) => {
  // Accept the formats the cropper / browsers commonly emit. Webp is what
  // the rest of the pipeline already converts to (see WebpValidationPipe);
  // accepting it on intake avoids re-crop loops that produce webp blobs.
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|avif)$/)) {
    cb(new Error("Only image files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

@Controller("events")
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly eventImportService: EventImportService,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Plan") private readonly planModel: Model<any>,
    @InjectModel("OrganizerStore")
    private readonly organizerStoreModel: Model<any>,
  ) {}

  // Merge event sponsor logos from the client's `sponsorManifest`: "existing"
  // entries keep their stored URL, "new" entries consume the next uploaded
  // file in order. Falls back to just the uploaded files when no manifest is
  // sent. Returns undefined only when there's nothing at all (no manifest, no
  // files) so callers can decide whether to leave the field untouched. Always
  // deletes the helper `sponsorManifest` off the body.
  private rebuildSponsors(
    body: any,
    files: Express.Multer.File[] | undefined,
  ): string[] | undefined {
    let manifest: any[] | null = null;
    if (typeof body?.sponsorManifest === "string") {
      try {
        manifest = JSON.parse(body.sponsorManifest);
      } catch {
        manifest = null;
      }
    }
    delete body.sponsorManifest;
    const uploaded = files || [];
    if (Array.isArray(manifest)) {
      let idx = 0;
      return manifest
        .map((item: any) => {
          if (item?.type === "new") {
            const f = uploaded[idx++];
            return f ? `/uploads/events/${f.filename}` : null;
          }
          return item?.url || null;
        })
        .filter((u: string | null): u is string => !!u);
    }
    if (uploaded.length > 0) {
      return uploaded.map((f) => `/uploads/events/${f.filename}`);
    }
    return undefined;
  }

  // Build a slug from organizationName that mirrors what the public
  // storefront route expects (lowercase, alphanum + dashes only). Falls
  // back to a stable token derived from the org's _id so the URL always
  // works even if the name is empty / non-Latin.
  private slugifyName(name: string, fallback: string): string {
    const cleaned = (name || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    return cleaned || `org-${fallback.slice(-6)}`;
  }

  // Individual users (Google-signed-in, never registered as an organizer)
  // don't yet have an Organizer document. On their first event publish we
  // lazy-create one with accountType:"Individual" and auto-assign the
  // default Individual plan so the rest of the events/attendees pipeline
  // — which all keys off organizerId — has a valid record to attach to.
  private async ensureIndividualOrganizer(user: {
    email?: string;
    name?: string;
    sub?: string;
    country?: string;
  }): Promise<any> {
    const email = (user?.email || "").toLowerCase();
    if (!email) {
      throw new ForbiddenException("Token missing email — please sign in again.");
    }
    const existing = await this.organizerModel.findOne({ email });
    if (existing) {
      // Backfill country once if the existing Individual row never got
      // one (created before the locale-aware sign-in flow). Lets the
      // chatbot pick ₹/$ on the very next "my events" call without
      // re-signing in.
      if (!existing.country && user?.country) {
        existing.country = user.country.toUpperCase();
        await existing.save?.();
      }
      return existing;
    }

    const defaultPlan = await this.planModel.findOne({
      moduleType: "Individual",
      isDefault: true,
      isActive: true,
    });
    const validity = Number(defaultPlan?.validityInDays);
    const hasValidity =
      !!defaultPlan &&
      (((defaultPlan as any).validityType === "date" &&
        !!(defaultPlan as any).validUntil) ||
        (Number.isFinite(validity) && validity > 0));
    const subFields = hasValidity
      ? {
          subscribed: true,
          planId: defaultPlan._id,
          planStartDate: new Date(),
          planExpiryDate: computePlanExpiry(defaultPlan as any),
          pricePaid: defaultPlan.price?.toString?.() ?? "0",
        }
      : {};
    const displayName = user?.name || email.split("@")[0];
    // whatsAppNumber + businessEmail have unique indexes — use synthetic
    // placeholders keyed on email so each Individual gets a distinct value.
    const newOrg = await new this.organizerModel({
      name: displayName,
      email,
      organizationName: displayName,
      businessEmail: email,
      whatsAppNumber: `individual:${email}`,
      accountType: "Individual",
      // Insight field: mark this row as having ORIGINATED from the
      // Individual lazy-create path. If the user later finishes full
      // Organizer registration, registerOrganizer will flip this to
      // "upgraded" so we can report on the conversion funnel.
      organizerType: "individual",
      // Country from the JWT (parsed at sign-in from Google's locale).
      // Drives the chatbot currency picker ₹/$ etc. without ever
      // surfacing a country selector. Empty -> defaults to US later.
      country: (user?.country || "").toUpperCase() || undefined,
      approved: true,
      rejected: false,
      provider: "google",
      ...subFields,
    }).save();

    // Lazy-create a default storefront so the public event link has a
    // complete branded URL (/{slug}/events/{id}) instead of the bare
    // /events/{id} fallback. Idempotent — if a row already exists for
    // this organizer (unique organizerId index), we just leave it alone.
    try {
      const alreadyHasStore = await this.organizerStoreModel
        .exists({ organizerId: newOrg._id })
        .catch(() => null);
      if (!alreadyHasStore) {
        const slug = await this.findFreeStoreSlug(
          this.slugifyName(displayName, String(newOrg._id)),
        );
        // Pass the FULL settings shape — passing a partial would override
        // Mongoose's schema default for `settings` and leave design /
        // features / seo missing entirely.
        await new this.organizerStoreModel({
          organizerId: newOrg._id,
          slug,
          settings: buildDefaultStorefrontSettings({
            storeName: displayName,
            email,
          }),
        }).save();
      }
    } catch (err) {
      // Non-fatal — the bare /events/:id link still works without a
      // storefront row. Just log and continue.
      console.error(
        "[ensureIndividualOrganizer] storefront create failed:",
        (err as any)?.message,
      );
    }

    return newOrg;
  }

  // Find a slug that doesn't already exist in organizer_stores. Appends a
  // short suffix if the base is taken (a different Individual may have
  // the same display name).
  private async findFreeStoreSlug(base: string): Promise<string> {
    const clean = base || "store";
    const taken = await this.organizerStoreModel.exists({ slug: clean });
    if (!taken) return clean;
    for (let i = 0; i < 8; i++) {
      const candidate = `${clean}-${Math.random().toString(36).slice(2, 6)}`;
      const exists = await this.organizerStoreModel.exists({ slug: candidate });
      if (!exists) return candidate;
    }
    return `${clean}-${Date.now().toString(36)}`;
  }

  @Post("import-from-url")
  @UseGuards(AuthGuard("jwt"))
  async importFromUrl(@Body() body: { url: string }) {
    return this.eventImportService.importFromUrl({ url: body?.url });
  }

  // Rebuild an event's gallery from the form's `galleryManifest` so EXISTING
  // images are kept and newly-uploaded files are appended in the organizer's
  // order. The manifest lists every slot — { type:"existing", url } or
  // { type:"new", filename } — and new files arrive (under "gallery") in that
  // same order, so we walk the manifest and pull the next uploaded file for
  // each "new" slot. Without this, editing an event and adding a photo would
  // replace the whole gallery with just the new file(s).
  //
  // Returns the ordered URL list, or `undefined` when there's nothing to apply
  // (no manifest and no new files) so the caller leaves the stored gallery
  // untouched.
  private resolveGalleryFromManifest(
    manifestRaw: unknown,
    galleryFiles: Express.Multer.File[] | undefined,
  ): string[] | undefined {
    const files = galleryFiles || [];
    if (typeof manifestRaw === "string" && manifestRaw.trim()) {
      try {
        const manifest = JSON.parse(manifestRaw);
        if (Array.isArray(manifest)) {
          let fi = 0;
          return manifest
            .map((e: any) => {
              if (e && e.type === "new") {
                const f = files[fi++];
                return f ? `/uploads/events/${f.filename}` : null;
              }
              return e && typeof e.url === "string" ? e.url : null;
            })
            .filter((u): u is string => Boolean(u));
        }
      } catch {
        // Malformed manifest — fall back to the file-only behaviour below.
      }
    }
    // No usable manifest: treat the uploaded files as the whole gallery.
    if (files.length > 0) {
      return files.map((f) => `/uploads/events/${f.filename}`);
    }
    return undefined;
  }

  @Post("create-event")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "banner", maxCount: 1 },
        { name: "gallery", maxCount: 5 },
        { name: "sponsorLogos", maxCount: 50 },
        { name: "addOnImages", maxCount: 100 },
        { name: "speakerImages", maxCount: 20 },
      ],
      {
        storage: diskStorage({
          destination: "./uploads/events",
          filename: generateFileName,
        }),
        fileFilter: imageFilter,
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB per image file
          // Non-file text fields (venueTables, venueRoundTables,
          // venueAnnotations, etc.) are JSON strings that can get large on
          // big layouts. multer defaults to 1MB/field which rejected those
          // with "Field value too long" — raise it generously.
          fieldSize: 25 * 1024 * 1024, // 25MB per text field
        },
      },
    ),
  )
  async createEvent(
    @UploadedFiles(WebpValidationPipe)
    files: {
      banner?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
      sponsorLogos?: Express.Multer.File[];
      addOnImages?: Express.Multer.File[];
      speakerImages?: Express.Multer.File[];
    },
    @Body() body: any,
    @Req() req: any,
  ) {
    try {
      const roles: string[] = req.user?.roles || [];
      const isOrganizer = roles.includes("organizer") || roles.includes("admin");
      const isIndividual = roles.includes("individual");
      if (!isOrganizer && !isIndividual) {
        throw new ForbiddenException({
          message: "Sign in to create events.",
          redirectTo: "/",
        });
      }

      if (isIndividual && !isOrganizer) {
        // Lazy-create the Organizer row backing this Individual user. The
        // first publish becomes a one-shot upgrade: the JWT still says
        // roles:["individual"] (frontend keeps chatbot-only UI), but
        // events/attendees/tickets now key off a real organizerId.
        const org = await this.ensureIndividualOrganizer({
          email: req.user?.email,
          name: req.user?.name,
          sub: req.user?.sub,
          country: req.user?.country,
        });
        body.organizerId = String(org._id);
      } else {
        // Extract organizer ID from JWT token
        body.organizerId = req.user.userId || req.user.sub || body.organizerId;
      }

      // Parse JSON strings from FormData
      if (typeof body.tags === "string") body.tags = JSON.parse(body.tags);
      if (typeof body.categories === "string")
        body.categories = JSON.parse(body.categories);
      // Keep singular `category` in sync with the first entry so legacy
      // read-sites that show `event.category` keep working.
      if (Array.isArray(body.categories) && body.categories.length > 0) {
        body.category = body.categories[0];
      }
      // eventType is an enum ("commercial" | "personal"). Legacy events (and
      // any form that leaves it blank) send "" — which Mongoose rejects as an
      // invalid enum value. Drop it so the field just stays unset rather than
      // failing the whole save.
      if (!body.eventType) delete body.eventType;
      if (typeof body.features === "string")
        body.features = JSON.parse(body.features);
      if (typeof body.socialMedia === "string")
        body.socialMedia = JSON.parse(body.socialMedia);
      if (typeof body.tableTemplates === "string")
        body.tableTemplates = JSON.parse(body.tableTemplates);
      if (typeof body.venueTables === "string")
        body.venueTables = JSON.parse(body.venueTables);
      if (typeof body.addOnItems === "string")
        body.addOnItems = JSON.parse(body.addOnItems);
      if (typeof body.venueConfig === "string")
        body.venueConfig = JSON.parse(body.venueConfig);

      if (typeof body.termsAndConditionsforStalls === "string")
        body.termsAndConditionsforStalls = JSON.parse(
          body.termsAndConditionsforStalls,
        );
      if (typeof body.visitorTypes === "string")
        body.visitorTypes = JSON.parse(body.visitorTypes);

      // Individuals can't accept payment (no Razorpay / Stripe account,
      // no bank details). Force every visitor-type price to 0 so tickets
      // are free regardless of what the form sent — defense-in-depth
      // against any client-side bypass.
      if (isIndividual && Array.isArray(body.visitorTypes)) {
        body.visitorTypes = body.visitorTypes.map((v: any) => ({
          ...v,
          price: 0,
        }));
        body.ticketPrice = "0";
      }

      if (typeof body.speakers === "string")
        body.speakers = JSON.parse(body.speakers);
      if (typeof body.speakerSlotTemplates === "string")
        body.speakerSlotTemplates = JSON.parse(body.speakerSlotTemplates);
      if (typeof body.venueSpeakerZones === "string")
        body.venueSpeakerZones = JSON.parse(body.venueSpeakerZones);
      if (typeof body.roundTableTemplates === "string")
        body.roundTableTemplates = JSON.parse(body.roundTableTemplates);
      if (typeof body.venueRoundTables === "string")
        body.venueRoundTables = JSON.parse(body.venueRoundTables);
      if (typeof body.venueAnnotations === "string")
        body.venueAnnotations = JSON.parse(body.venueAnnotations);
      // Placed entrance / exit doors — same multipart-JSON unwrap as
      // every other venue array. Missing field stays undefined so
      // existing events don't get their doors zeroed out by a partial
      // payload.
      if (typeof body.venueDoors === "string")
        body.venueDoors = JSON.parse(body.venueDoors);
      if (typeof body.volunteers === "string")
        body.volunteers = JSON.parse(body.volunteers);
      // Marriage/Personal ceremonies + couple details travel as JSON strings.
      if (typeof body.functions === "string")
        body.functions = JSON.parse(body.functions);
      if (typeof body.marriage === "string")
        body.marriage = JSON.parse(body.marriage);
      // Instagram reel URLs travel as a JSON-stringified array because
      // multipart can't carry a native array — unwrap the same way the
      // other list fields above do.
      if (typeof body.reelLinks === "string")
        body.reelLinks = JSON.parse(body.reelLinks);
      // Announcement / Ad Bar — small object, sent JSON-stringified
      // through multipart same as the other nested settings.
      if (typeof body.adBar === "string")
        body.adBar = JSON.parse(body.adBar);
      // Eventfront chatbot config ({ enabled, name }) — small object, sent
      // JSON-stringified same as adBar.
      if (typeof body.chatbot === "string")
        body.chatbot = JSON.parse(body.chatbot);
      // Custom Basic-Info sections (each: id + heading + content) —
      // sent JSON-stringified.
      if (typeof body.customSections === "string")
        body.customSections = JSON.parse(body.customSections);
      // Always normalize to a clean { key: boolean } map (guards against the
      // legacy self-concatenation bug that bloated this field into MBs).
      body.sectionVisibility = sanitizeSectionVisibility(body.sectionVisibility);

      // Compress every uploaded image (downscale + WebP) before building URLs.
      await compressEventUploadFiles(files);

      // Handle banner image
      if (files.banner && files.banner[0]) {
        body.image = `/uploads/events/${files.banner[0].filename}`;
      }

      // Build the gallery from the manifest (keeps duplicated events' existing
      // image URLs and orders new uploads correctly).
      {
        const resolvedGallery = this.resolveGalleryFromManifest(
          body.galleryManifest,
          files.gallery,
        );
        if (resolvedGallery !== undefined) body.gallery = resolvedGallery;
      }
      delete body.galleryManifest;

      // Sponsor logos — rebuild from the manifest so existing URLs (on edit)
      // and freshly uploaded files combine in the order the organizer arranged.
      body.sponsors = this.rebuildSponsors(body, files.sponsorLogos) ?? [];

      if (
        files.addOnImages &&
        files.addOnImages.length > 0 &&
        Array.isArray(body.addOnItems)
      ) {
        let imageIndex = 0;

        body.addOnItems = body.addOnItems.map((addon) => {
          if (addon.hasNewImage && imageIndex < files.addOnImages.length) {
            addon.image = `/uploads/events/${files.addOnImages[imageIndex].filename}`;
            imageIndex++;
          }
          return addon;
        });
      }

      // Handle speaker images
      if (
        files.speakerImages &&
        files.speakerImages.length > 0 &&
        Array.isArray(body.speakers)
      ) {
        let imgIdx = 0;
        body.speakers = body.speakers.map((speaker) => {
          if (speaker.hasNewImage && imgIdx < files.speakerImages.length) {
            speaker.image = `/uploads/events/${files.speakerImages[imgIdx].filename}`;
            imgIdx++;
          }
          delete speaker.hasNewImage;
          return speaker;
        });
      }

      const event = await this.eventsService.create(body);

      return {
        success: true,
        message: "Event created successfully",
        data: event,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get("get-events")
  async getAllEvents(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    try {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const result = await this.eventsService.findAll(p, l);
      return {
        success: true,
        message: "Events retrieved successfully",
        data: result.events,
        pagination: { total: result.total, page: p, limit: l },
      };
    } catch (error) {
      console.error("Error in getAllEvents:", error);
      throw error;
    }
  }

  @Get("search")
  async searchEvents(@Query("q") query: string) {
    try {
      const events = await this.eventsService.searchEvents(query);
      return {
        success: true,
        message: "Events searched successfully",
        data: events,
      };
    } catch (error) {
      console.error("Error in searchEvents:", error);
      throw error;
    }
  }

  @Get("organizer/:organizerId")
  async getEventsByOrganizer(
    @Param("organizerId") organizerId: string,
    @Query("publicOnly") publicOnly?: string,
  ) {
    try {
      const result = await this.eventsService.findByOrganizer(
        organizerId,
        publicOnly === "true" || publicOnly === "1",
      );
      return {
        success: true,
        message: "Organizer events retrieved successfully",
        data: result.events,
        pagination: {
          total: result.total,
        },
      };
    } catch (error) {
      console.error("Error in getEventsByOrganizer:", error);
      throw error;
    }
  }

  // ── Volunteer Google sign-in (redirect flow) ──────────────────────────────
  // Step 1: kick off the OAuth redirect. The eventId rides along in `state` so
  // the callback knows which event's volunteer allow-list to check.
  // NOTE: declared BEFORE @Get(":id") so "volunteer-google" isn't swallowed as
  // an :id param.
  @Get("volunteer-google")
  async volunteerGoogleStart(
    @Query("eventId") eventId: string,
    @Res() res: Response,
  ) {
    const base = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
    try {
      const url = this.eventsService.buildVolunteerGoogleAuthUrl(eventId);
      return res.redirect(url);
    } catch (e: any) {
      return res.redirect(
        `${base}/events/${eventId || ""}/scan-tickets?verror=${encodeURIComponent(
          e?.message || "Volunteer sign-in is unavailable.",
        )}`,
      );
    }
  }

  // Step 2: Google redirects back here with ?code & ?state(eventId). Verify the
  // id_token, confirm the Gmail is on the event's volunteer list, mint a
  // volunteer JWT, then bounce back to the scanner page with the token (or an
  // error message) in the query string.
  @Get("volunteer-google/redirect")
  async volunteerGoogleRedirect(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    const base = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
    const eventId = state || "";
    try {
      const result = await this.eventsService.handleVolunteerGoogleRedirect(
        code,
        state,
      );
      return res.redirect(
        `${base}/events/${result.eventId}/scan-tickets?vtoken=${encodeURIComponent(
          result.token,
        )}`,
      );
    } catch (e: any) {
      const msg =
        e?.message === "not_on_list"
          ? "This Google account isn't on the volunteer list for this event."
          : e?.message || "Google sign-in failed.";
      return res.redirect(
        `${base}/events/${eventId}/scan-tickets?verror=${encodeURIComponent(msg)}`,
      );
    }
  }

  @Get(":id")
  async getEventById(@Param("id") id: string) {
    try {
      const event: any = await this.eventsService.findById(id);
      // Many event rows in this DB have `organizer` stored as a plain
      // string instead of an ObjectId (schema says ObjectId but writes
      // landed as String). Mongoose's `populate("organizer")` returns
      // null in that case and EventFront crashes on
      // `data.organizer._id`. Fall back to a manual lookup so the page
      // renders for both legacy AND newly-created (Individual) events.
      const dataObj =
        event && typeof event.toObject === "function" ? event.toObject() : event;
      if (dataObj && !dataObj.organizer) {
        const raw: any = await this.eventModelDirect()
          .findById(id)
          .lean();
        const orgIdStr = raw?.organizer ? String(raw.organizer) : null;
        if (orgIdStr) {
          const org = await this.organizerModel.findById(orgIdStr).lean();
          if (org) dataObj.organizer = org;
        }
      }
      return {
        success: true,
        message: "Event retrieved successfully",
        data: dataObj,
      };
    } catch (error) {
      console.error("Error in getEventById:", error);
      throw error;
    }
  }

  // Direct event-model accessor for the populate-fallback path. We don't
  // want to bloat events.service with a manual-lookup variant just for
  // this controller, so reach for the underlying model via the Mongoose
  // factory we already use elsewhere in this file. (eventsService owns
  // the canonical findById; this is purely a recovery hatch.)
  private eventModelDirect() {
    return (this.eventsService as any).eventModel as Model<any>;
  }

  // Volunteer email-OTP sign-in for the scanner page. Two endpoints:
  // send-volunteer-otp gates on the event's allow-list before mailing the
  // code; verify-volunteer-otp confirms the code and returns the matched
  // volunteer record. Both are public — gating is on the email being in
  // event.volunteers, not on any session.
  @Post(":id/send-volunteer-otp")
  async sendVolunteerOtp(
    @Param("id") id: string,
    @Body() body: { email: string },
  ) {
    return this.eventsService.sendVolunteerOtp(id, body?.email);
  }

  @Post(":id/verify-volunteer-otp")
  async verifyVolunteerOtp(
    @Param("id") id: string,
    @Body() body: { email: string; otp: string },
  ) {
    return this.eventsService.verifyVolunteerOtp(id, body?.email, body?.otp);
  }

  // Google-Auth volunteer sign-in: verify the Google id_token and confirm the
  // Gmail is on the event's volunteer allow-list. Public — gating is on the
  // verified email being in event.volunteers.
  @Post(":id/verify-volunteer-google")
  async verifyVolunteerGoogle(
    @Param("id") id: string,
    @Body() body: { credential: string },
  ) {
    return this.eventsService.verifyVolunteerGoogle(id, body?.credential);
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "banner", maxCount: 1 },
        { name: "gallery", maxCount: 5 },
        { name: "sponsorLogos", maxCount: 50 },
        { name: "addOnImages", maxCount: 100 },
        { name: "speakerImages", maxCount: 20 },
      ],
      {
        storage: diskStorage({
          destination: "./uploads/events",
          filename: generateFileName,
        }),
        fileFilter: imageFilter,
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB per image file
          // Large JSON text fields (venueTables / venueAnnotations / etc.)
          // exceed multer's 1MB/field default — raise it so big layouts save.
          fieldSize: 25 * 1024 * 1024, // 25MB per text field
        },
      },
    ),
  )
  async updateEvent(
    @Param("id") id: string,
    @UploadedFiles(WebpValidationPipe)
    files: {
      banner?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
      sponsorLogos?: Express.Multer.File[];
      addOnImages?: Express.Multer.File[];
      speakerImages?: Express.Multer.File[];
    },
    @Body() body: any,
    @Req() req: any,
  ) {
    try {
      const updateRoles: string[] = req.user?.roles || [];
      const updateIsIndividual = updateRoles.includes("individual");
      // Parse JSON strings from FormData
      if (typeof body.tags === "string") body.tags = JSON.parse(body.tags);
      if (typeof body.categories === "string")
        body.categories = JSON.parse(body.categories);
      if (Array.isArray(body.categories) && body.categories.length > 0) {
        body.category = body.categories[0];
      }
      // Never overwrite the enum-constrained eventType with a blank value on
      // update — legacy events have none stored and the form sends "". Dropping
      // it leaves the field untouched instead of failing enum validation.
      if (!body.eventType) delete body.eventType;
      if (typeof body.features === "string")
        body.features = JSON.parse(body.features);
      if (typeof body.socialMedia === "string")
        body.socialMedia = JSON.parse(body.socialMedia);
      if (typeof body.tableTemplates === "string")
        body.tableTemplates = JSON.parse(body.tableTemplates);
      if (typeof body.venueTables === "string")
        body.venueTables = JSON.parse(body.venueTables);
      if (typeof body.addOnItems === "string")
        body.addOnItems = JSON.parse(body.addOnItems);
      if (typeof body.venueConfig === "string")
        body.venueConfig = JSON.parse(body.venueConfig);

      if (typeof body.termsAndConditionsforStalls === "string")
        body.termsAndConditionsforStalls = JSON.parse(
          body.termsAndConditionsforStalls,
        );
      if (typeof body.visitorTypes === "string")
        body.visitorTypes = JSON.parse(body.visitorTypes);

      // Mirror the create-event policy: Individuals can't accept payment
      // (no Razorpay / Stripe / bank). Force every visitor-type price to
      // 0 on update too — server-side guard against any client bypass.
      if (updateIsIndividual && Array.isArray(body.visitorTypes)) {
        body.visitorTypes = body.visitorTypes.map((v: any) => ({
          ...v,
          price: 0,
        }));
        body.ticketPrice = "0";
      }

      if (typeof body.speakers === "string")
        body.speakers = JSON.parse(body.speakers);
      if (typeof body.speakerSlotTemplates === "string")
        body.speakerSlotTemplates = JSON.parse(body.speakerSlotTemplates);
      if (typeof body.venueSpeakerZones === "string")
        body.venueSpeakerZones = JSON.parse(body.venueSpeakerZones);
      if (typeof body.roundTableTemplates === "string")
        body.roundTableTemplates = JSON.parse(body.roundTableTemplates);
      if (typeof body.venueRoundTables === "string")
        body.venueRoundTables = JSON.parse(body.venueRoundTables);
      if (typeof body.venueAnnotations === "string")
        body.venueAnnotations = JSON.parse(body.venueAnnotations);
      // Placed entrance / exit doors — same unwrap as the create path.
      if (typeof body.venueDoors === "string")
        body.venueDoors = JSON.parse(body.venueDoors);
      if (typeof body.volunteers === "string")
        body.volunteers = JSON.parse(body.volunteers);
      // Marriage/Personal ceremonies + couple details travel as JSON strings.
      if (typeof body.functions === "string")
        body.functions = JSON.parse(body.functions);
      if (typeof body.marriage === "string")
        body.marriage = JSON.parse(body.marriage);
      // Instagram reel URLs — same unwrap as the create path.
      if (typeof body.reelLinks === "string")
        body.reelLinks = JSON.parse(body.reelLinks);
      // Announcement / Ad Bar — same unwrap as the create path.
      if (typeof body.adBar === "string")
        body.adBar = JSON.parse(body.adBar);
      // Eventfront chatbot config — same unwrap as the create path.
      if (typeof body.chatbot === "string")
        body.chatbot = JSON.parse(body.chatbot);
      // Custom Basic-Info sections — same unwrap as the create path.
      if (typeof body.customSections === "string")
        body.customSections = JSON.parse(body.customSections);
      // Always normalize to a clean { key: boolean } map (guards against the
      // legacy self-concatenation bug that bloated this field into MBs).
      body.sectionVisibility = sanitizeSectionVisibility(body.sectionVisibility);

      // Compress every uploaded image (downscale + WebP) before we build the
      // URLs, so stored files stay small. Mutates each file's filename to .webp.
      await compressEventUploadFiles(files);

      // Handle new banner image
      if (files.banner && files.banner[0]) {
        body.image = `/uploads/events/${files.banner[0].filename}`;
      }

      // Rebuild the gallery from the manifest so editing an event MERGES the
      // images the organizer kept with any newly uploaded ones — instead of
      // replacing the whole gallery with just the new files (which dropped the
      // existing images). The manifest lists every image to keep, in order;
      // each "new" entry consumes the next uploaded file, in the same order the
      // client appended them under the "gallery" field.
      let galleryManifest: any[] | null = null;
      if (typeof body.galleryManifest === "string") {
        try {
          galleryManifest = JSON.parse(body.galleryManifest);
        } catch {
          galleryManifest = null;
        }
      }
      if (Array.isArray(galleryManifest)) {
        const newGalleryFiles = files.gallery || [];
        let newFileIdx = 0;
        body.gallery = galleryManifest
          .map((item: any) => {
            if (item?.type === "new") {
              const file = newGalleryFiles[newFileIdx++];
              return file ? `/uploads/events/${file.filename}` : null;
            }
            // "existing" — keep the previously stored URL as-is.
            return item?.url || null;
          })
          .filter((url: string | null): url is string => !!url);
      } else if (files.gallery && files.gallery.length > 0) {
        // Legacy clients that don't send a manifest: keep the old behaviour.
        body.gallery = files.gallery.map(
          (file) => `/uploads/events/${file.filename}`,
        );
      }
      // Never persist the helper manifest onto the event document.
      delete body.galleryManifest;

      // Sponsors — merge existing + new via the manifest. Only touch the field
      // when the client actually sent sponsor data, so an unrelated update
      // never wipes existing sponsor logos.
      const rebuiltSponsors = this.rebuildSponsors(body, files.sponsorLogos);
      if (rebuiltSponsors !== undefined) {
        body.sponsors = rebuiltSponsors;
      } else {
        delete body.sponsors;
      }

      // 3. Handle Add-On Images (Mapping new files to correct items)
      if (
        files.addOnImages &&
        files.addOnImages.length > 0 &&
        Array.isArray(body.addOnItems)
      ) {
        let imageIndex = 0;

        body.addOnItems = body.addOnItems.map((addon) => {
          // If frontend says a new image was uploaded for this item
          if (addon.hasNewImage && imageIndex < files.addOnImages.length) {
            addon.image = `/uploads/events/${files.addOnImages[imageIndex].filename}`;
            imageIndex++;
          }
          // Remove the helper flag before saving to DB
          delete addon.hasNewImage;
          return addon;
        });
      }

      // Handle speaker images
      if (
        files.speakerImages &&
        files.speakerImages.length > 0 &&
        Array.isArray(body.speakers)
      ) {
        let imgIdx = 0;
        body.speakers = body.speakers.map((speaker) => {
          if (speaker.hasNewImage && imgIdx < files.speakerImages.length) {
            speaker.image = `/uploads/events/${files.speakerImages[imgIdx].filename}`;
            imgIdx++;
          }
          delete speaker.hasNewImage;
          return speaker;
        });
      }

      const event = await this.eventsService.update(id, body);

      return {
        success: true,
        message: "Event updated successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in updateEvent:", error);
      throw error;
    }
  }

  @Put(":id/status")
  @UseGuards(AuthGuard("jwt"))
  async updateEventStatus(
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    try {
      const event = await this.eventsService.updateStatus(id, status);
      return {
        success: true,
        message: "Event status updated successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in updateEventStatus:", error);
      throw error;
    }
  }

  // Toggle the public eventfront link on/off (My Events "Publish" switch).
  @Patch(":id/publish")
  @UseGuards(AuthGuard("jwt"))
  async setPublished(
    @Param("id") id: string,
    @Body("published") published: boolean,
  ) {
    try {
      const event = await this.eventsService.setPublished(id, !!published);
      return {
        success: true,
        message: published ? "Event published" : "Event unpublished",
        data: event,
      };
    } catch (error) {
      console.error("Error in setPublished:", error);
      throw error;
    }
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async deleteEvent(@Param("id") id: string, @Req() req: any) {
    try {
      const event = await this.eventsService.remove(id);
      return {
        success: true,
        message: "Event deleted successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in deleteEvent:", error);
      throw error;
    }
  }
}
