import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { extname, resolve, sep } from "path";
import { Ticket } from "../tickets/entities/ticket.entity";
import { Stall } from "../stalls/entities/stall.entity";
import { Vendor } from "../stalls/schemas/vendor.schema";
import { RoundTableBooking } from "../round-table-bookings/entities/round-table-booking.entity";
import { WorkshopBooking } from "../workshop-bookings/entities/workshop-booking.entity";
import { SpeakerRequest } from "../speaker-requests/entities/speaker-request.entity";
import { ScheduledSpaceRequest } from "../scheduled-spaces/entities/scheduled-space-request.entity";
import { ExhibitorMembership } from "../memberships/schemas/exhibitor-membership.schema";
import { Rsvp } from "../rsvp/schemas/rsvp.schema";
import { Supplier } from "../suppliers/schemas/supplier.schema";
import { SponsorRequest } from "../sponsors/entities/sponsor-request.entity";
import { User } from "../users/schemas/user.schema";
import { OrganizerStore } from "../organizer-stores/entities/organizer-store.entity";
import { OrganizerWhatsappService } from "../whatsapp/organizer-whatsapp.service";
import { plainName } from "../whatsapp/whatsapp-text";
import { MarketingOptOut } from "./entities/marketing-opt-out.entity";
import { ContactSource } from "./entities/whatsapp-campaign.entity";
import { CampaignRequestDto, CONTACT_ID, requestedSources } from "./dto/campaign-request.dto";
import { CampaignVars, render, renderedLength } from "./campaign-template";

/** A larger audience should be split: past this the campaign record itself
 * approaches MongoDB's 16 MB document limit (every recipient stores the text
 * it is sent), and at the default daily cap it would take a week to send. */
export const MAX_SENDABLE = 1000;

/**
 * How many contacts one source reads before giving up. The selection is
 * otherwise unbounded — an organizer decides how many attendees it has — and
 * every one is loaded, named and measured before MAX_SENDABLE can refuse the
 * campaign. An organizer with more contacts than this has far more than
 * MAX_SENDABLE to message, so the answer is "narrow it down" either way.
 */
const MAX_CANDIDATES = 5 * MAX_SENDABLE;

/**
 * Why a contact is not messaged. These exact sentences are stored on the
 * recipient row and double as i18n keys — the dashboard translates them by
 * looking the English up — so they are never built from parts.
 */
export const SKIP = {
  noNumber: "No WhatsApp number",
  ownNumber: "Organizer's own number",
  optedOut: "Opted out of marketing",
  invalid: "Invalid number",
  duplicate: "Duplicate number",
  notOnWhatsapp: "Not on WhatsApp",
  tooLong: "Message too long",
  stopped: "Campaign stopped",
} as const;

/** WhatsApp's own ceilings. It rejects a longer message outright rather than
 * truncating it, so an over-long one is a skip decided up front. */
export const MAX_TEXT = 4096;
export const MAX_CAPTION = 1024;

/** A Mongo ObjectId as a string — checked before it reaches a query, where
 * anything else would be a cast error. */
const OBJECT_ID = /^[a-f0-9]{24}$/i;

export const IMAGE_MISSING_WARNING =
  "The event image could not be found, so messages are sent without it.";
export const IMAGE_NEEDS_EVENT_WARNING =
  "Choose an event to attach its image; messages are sent without one.";

/** Names that are placeholders somebody's code wrote, not a person's name. */
const NOT_A_NAME = [/^guest( user)?$/i, /^walk-?\s?in/i, /^customer$/i, /^unknown$/i, /^n\/?a$/i];

/** Sources that carry an event id; the rest are organizer-wide and ignore an
 * event filter (or drop out of an event-scoped "all"). */
const EVENT_SCOPED: ReadonlySet<ContactSource> = new Set<ContactSource>([
  "tickets",
  "stalls",
  "speakers",
  "roundtables",
  "workshops",
  "spaces",
  "rsvps",
  "sponsors",
]);

const EVERY_SOURCE: ContactSource[] = [
  "tickets",
  "stalls",
  "speakers",
  "roundtables",
  "workshops",
  "spaces",
  "members",
  "rsvps",
  "sponsors",
  "suppliers",
  "crm",
];

/**
 * The `{{name}}` for one contact: the first candidate that looks like a real
 * person's name, cleaned by plainName, or "" so the template's fallback
 * ("there") applies. A false negative only costs a less personal greeting; a
 * false positive greets an attendee as "Hello Guest User", which is worse
 * than no name at all. A candidate equal to the local part of the contact's
 * email is also passed over: Google sign-in stores exactly that as the
 * account name, and "Hello rbgoda" is a username, not a greeting.
 */
export function resolveContactName(
  candidates: unknown[],
  email?: string | null,
): string {
  const emailPrefix = String(email ?? "")
    .split("@")[0]
    .trim()
    .toLowerCase();
  for (const candidate of candidates) {
    const trimmed = cleanCandidate(candidate);
    if (!trimmed) continue;
    if (NOT_A_NAME.some((pattern) => pattern.test(trimmed))) continue;
    if (emailPrefix && trimmed.toLowerCase() === emailPrefix) continue;
    const clean = plainName(trimmed, "");
    if (clean) return clean;
  }
  return "";
}

/** A stored name with the words string concatenation leaves behind removed
 * ("Asha undefined" when a last name was left empty). */
function cleanCandidate(candidate: unknown): string {
  return String(candidate ?? "")
    .replace(/\b(?:undefined|null)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `{{first_name}}`: the first word of the resolved name. */
export function firstNameOf(name: string): string {
  return String(name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The last four digits, for anything a person or a log reads. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return `…${digits.slice(-4)}`;
}

/**
 * The file on disk behind an event image path ("/uploads/events/x.jpg"), or
 * null when the path does not point inside uploads/.
 *
 * The path comes from an event record, and it decides which file the server
 * reads off its own disk and sends to a stranger's phone, so it is held to
 * two independent checks: no ".." segment at all, and the resolved path must
 * still sit under the uploads root. An image hosted elsewhere (a full URL) is
 * not ours to read, and is also null.
 */
export function resolveUploadPath(stored: string | null | undefined): string | null {
  const raw = String(stored ?? "").trim();
  if (!raw || raw.includes("\0")) return null;
  // Event images are stored as "/uploads/events/x.jpg" or as a full URL on
  // this API ("https://api…/uploads/events/x.jpg"); both point at uploads/.
  const match = /(?:^|\/)uploads\/(.+)$/.exec(raw.replace(/^https?:\/\/[^/]+/i, ""));
  if (!match) return null;
  const rest = match[1].split(/[?#]/)[0];
  if (!rest || rest.split(/[\\/]/).includes("..")) return null;
  const root = resolve(process.cwd(), "uploads");
  const full = resolve(root, rest);
  if (!full.startsWith(root + sep)) return null;
  return full;
}

/** The MIME type WhatsApp is told for an image. Baileys assumes JPEG when
 * told nothing, and the event upload also accepts PNG, GIF and WebP. */
export function imageMimetype(path: string): string | undefined {
  const ext = extname(path).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return undefined;
}

/** One person the organizer can message, read from one of their records. */
export type Contact = {
  /** `<source>:<document id>[:<index>]` */
  id: string;
  source: Exclude<ContactSource, "all">;
  /** What the record calls them, cleaned for display (never sent as is). */
  name: string;
  email: string;
  /** As stored. */
  phone: string;
  eventId: string | null;
  eventTitle: string;
  createdAt: string | null;
};

export type AudienceRow = {
  contactId: string;
  name: string;
  /** "+<digits>" when sendable; as stored otherwise. */
  phone: string;
  status: "pending" | "skipped";
  reason: string | null;
  sentAt: null;
  /** The rendered message; "" on a skipped row, and on a pending row whose
   * text the caller did not ask for (see BuildOptions). */
  text: string;
};

export type BuildOptions = {
  /**
   * Build the text of only the first `samples` sendable contacts — all a
   * preview shows. Every row is still measured against the length limit, so
   * the counts are exact either way. Without it every sendable row gets its
   * text, unless the audience is too big to send (see build()).
   */
  samples?: number;
};

export type BuiltAudience = {
  rows: AudienceRow[];
  willSend: number;
  /** "All contacts" was cut off at MAX_CANDIDATES: the counts cover only the
   * contacts read, and the campaign is too big to send. */
  truncated: boolean;
  hasImage: boolean;
  imagePath: string | null;
  eventId: string | null;
  eventTitle: string;
  warnings: string[];
};

type EventInfo = {
  id: string;
  title: string;
  startDate: Date | null;
  time: string;
  location: string;
  image: string;
};

/**
 * Who a campaign goes to, and exactly what each of them is sent.
 *
 * Built on the server from contact ids only. An organizer's contacts are the
 * people in its own records — ticket buyers, stall vendors, speakers,
 * round-table and workshop bookers, space registrants, members, RSVP guests,
 * sponsors, suppliers and the CRM rows it added by hand; an id outside that
 * set is ignored, whoever sent it. Names and numbers are read here from the
 * database, never taken from the browser.
 *
 * Also the keeper of the opt-out list, since that is audience data too.
 */
@Injectable()
export class CampaignAudienceService {
  private readonly logger = new Logger(CampaignAudienceService.name);

  constructor(
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    @InjectModel(OrganizerStore.name) private readonly storeModel: Model<any>,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<any>,
    @InjectModel(Stall.name) private readonly stallModel: Model<any>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<any>,
    @InjectModel(RoundTableBooking.name) private readonly roundTableModel: Model<any>,
    @InjectModel(WorkshopBooking.name) private readonly workshopModel: Model<any>,
    @InjectModel(SpeakerRequest.name) private readonly speakerModel: Model<any>,
    @InjectModel(ScheduledSpaceRequest.name) private readonly spaceModel: Model<any>,
    @InjectModel(ExhibitorMembership.name) private readonly membershipModel: Model<any>,
    @InjectModel(Rsvp.name) private readonly rsvpModel: Model<any>,
    @InjectModel(Supplier.name) private readonly supplierModel: Model<any>,
    @InjectModel(SponsorRequest.name) private readonly sponsorModel: Model<any>,
    @InjectModel(User.name) private readonly userModel: Model<any>,
    @InjectModel(MarketingOptOut.name)
    private readonly optOutModel: Model<MarketingOptOut>,
    private readonly whatsapp: OrganizerWhatsappService,
  ) {}

  // ── Events ───────────────────────────────────────────────────────────────

  /** Events store `organizer` as a string on most records and as an
   * ObjectId on some (the path is not cast), so every read matches both —
   * the same way the dashboard's own events list does. */
  private organizerMatch(organizerId: string) {
    return { $in: [organizerId, new Types.ObjectId(organizerId)] };
  }

  /** The organizer's events, newest first, for the composer's picker. */
  async listEvents(organizerId: string) {
    const id = assertOrganizerId(organizerId);
    const events = await this.eventModel
      .find({ organizer: this.organizerMatch(id) })
      .select("title startDate image")
      .sort({ startDate: -1 })
      .limit(500)
      .lean();
    return events.map((e: any) => ({
      id: String(e._id),
      title: String(e.title ?? ""),
      startDate: e.startDate ? new Date(e.startDate).toISOString() : null,
      hasImage: !!resolveUploadPath(e.image),
      // As stored ("/uploads/events/x.webp" or a full URL) so the composer
      // can show a thumbnail of what will be attached.
      image: resolveUploadPath(e.image) ? String(e.image) : null,
    }));
  }

  /** The organizer's events by id, for titles and `{{event}}` values. */
  private async eventsById(organizerId: string): Promise<Map<string, EventInfo>> {
    const events = await this.eventModel
      .find({ organizer: this.organizerMatch(organizerId) })
      .select("title startDate time location image")
      .lean();
    const map = new Map<string, EventInfo>();
    for (const e of events as any[]) {
      map.set(String(e._id), {
        id: String(e._id),
        title: String(e.title ?? ""),
        startDate: e.startDate ? new Date(e.startDate) : null,
        time: String(e.time ?? ""),
        location: String(e.location ?? ""),
        image: String(e.image ?? ""),
      });
    }
    return map;
  }

  // ── Contacts ─────────────────────────────────────────────────────────────

  /**
   * Everyone in one of the organizer's collections (or all of them), with an
   * optional event filter. "All" de-duplicates by number across sources, in
   * the order of EVERY_SOURCE, so a ticket buyer who also booked a table is
   * listed once. Each source reads at most MAX_CANDIDATES rows, newest first.
   */
  async listContacts(
    organizerId: string,
    source: ContactSource | ContactSource[],
    eventId?: string,
  ): Promise<{ contacts: Contact[]; truncated: boolean }> {
    const id = assertOrganizerId(organizerId);
    const event = eventId && OBJECT_ID.test(eventId) ? eventId : undefined;
    const events = await this.eventsById(id);
    if (event && !events.has(event)) throw new NotFoundException("Event not found.");

    // One source, several (the composer's groups), or everyone. With an
    // event, only event-based sources remain — organizer-wide lists (CRM,
    // members, suppliers) have no bookings on an event to match.
    const wanted = requestedSources(
      Array.isArray(source) ? { sources: source } : { source },
    );
    const everyone = wanted.includes("all");
    const sources: ContactSource[] = everyone
      ? event
        ? EVERY_SOURCE.filter((s) => EVENT_SCOPED.has(s))
        : EVERY_SOURCE
      : wanted.filter((s) => EVERY_SOURCE.includes(s) && (!event || EVENT_SCOPED.has(s)));

    const contacts: Contact[] = [];
    // One row per person: the same name with the same WhatsApp number is one
    // contact, however many bookings they made and whichever sources list
    // them (sources are read newest first, so the row kept is the latest).
    // Without a number the email stands in; without either, the same name on
    // the same event is one (unreachable) row rather than one per booking.
    const seen = new Set<string>();
    const personKey = (c: Contact) => {
      const name = String(c.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      const email = String(c.email ?? "").trim().toLowerCase();
      const reach = rawDigits(c.phone) || (email ? `e:${email}` : `ev:${c.eventId ?? ""}`);
      return `${name}|${reach}`;
    };
    let truncated = false;
    for (const s of sources) {
      const rows = await this.readSource(
        id,
        s as Exclude<ContactSource, "all">,
        EVENT_SCOPED.has(s) ? event : undefined,
        events,
      );
      if (rows.length > MAX_CANDIDATES) truncated = true;
      for (const c of rows.slice(0, MAX_CANDIDATES)) {
        const key = personKey(c);
        if (seen.has(key)) continue;
        seen.add(key);
        contacts.push(c);
      }
    }
    return { contacts, truncated };
  }

  private async readSource(
    organizerId: string,
    source: Exclude<ContactSource, "all">,
    eventId: string | undefined,
    events: Map<string, EventInfo>,
  ): Promise<Contact[]> {
    const oid = new Types.ObjectId(organizerId);
    const org = { $in: [oid, organizerId] };
    const ev = eventId ? { $in: [new Types.ObjectId(eventId), eventId] } : undefined;
    const limit = MAX_CANDIDATES + 1;
    const titleOf = (e: unknown) => events.get(String(e ?? ""))?.title ?? "";
    const evId = (e: unknown) => {
      const s = String(e ?? "");
      return OBJECT_ID.test(s) ? s : null;
    };
    const iso = (d: unknown) => (d ? new Date(d as any).toISOString() : null);
    const withCode = (phone: unknown, code: unknown) => {
      const p = String(phone ?? "").trim();
      const c = String(code ?? "").trim();
      // A separate dial-code field ("+91") completes a national number; a
      // number that already carries a "+" or is long enough is left alone.
      if (p && c && /^\+\d{1,4}$/.test(c) && !p.startsWith("+") && p.replace(/\D/g, "").length <= 10) {
        return `${c}${p.replace(/\D/g, "")}`;
      }
      // Older records saved a bare "+" for an empty number — that is no number.
      return rawDigits(p) ? p : "";
    };

    switch (source) {
      case "tickets": {
        const rows = await this.ticketModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("customerName customerEmail customerWhatsapp eventId createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((t: any) => ({
          id: `tickets:${t._id}`,
          source,
          name: cleanCandidate(t.customerName),
          email: String(t.customerEmail ?? ""),
          phone: String(t.customerWhatsapp ?? ""),
          eventId: evId(t.eventId),
          eventTitle: titleOf(t.eventId),
          createdAt: iso(t.createdAt),
        }));
      }
      case "stalls": {
        const stalls = await this.stallModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("shopkeeperId eventId brandName nameOfApplicant createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        const vendorIds = [...new Set(stalls.map((s: any) => String(s.shopkeeperId ?? "")).filter((v) => OBJECT_ID.test(v)))];
        const vendors = vendorIds.length
          ? await this.vendorModel
              .find({ _id: { $in: vendorIds } })
              .select("name email businessEmail phone whatsAppNumber whatsappNumber phoneNumber countryCode nameOfApplicant")
              .lean()
          : [];
        const vendorById = new Map(vendors.map((v: any) => [String(v._id), v]));
        return stalls.map((s: any) => {
          const v: any = vendorById.get(String(s.shopkeeperId ?? "")) ?? {};
          return {
            id: `stalls:${s._id}`,
            source,
            name: cleanCandidate(s.nameOfApplicant || v.nameOfApplicant || v.name),
            email: String(v.email || v.businessEmail || ""),
            phone: withCode(v.whatsAppNumber || v.whatsappNumber || v.phone || v.phoneNumber, v.countryCode),
            eventId: evId(s.eventId),
            eventTitle: titleOf(s.eventId),
            createdAt: iso(s.createdAt),
          };
        });
      }
      case "speakers": {
        const rows = await this.speakerModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("name email phone eventId createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((r: any) => ({
          id: `speakers:${r._id}`,
          source,
          name: cleanCandidate(r.name),
          email: String(r.email ?? ""),
          phone: String(r.phone ?? ""),
          eventId: evId(r.eventId),
          eventTitle: titleOf(r.eventId),
          createdAt: iso(r.createdAt),
        }));
      }
      case "roundtables": {
        const rows = await this.roundTableModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("visitorName visitorEmail visitorPhone seatGuests eventId createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        const out: Contact[] = [];
        for (const r of rows as any[]) {
          out.push({
            id: `roundtables:${r._id}`,
            source,
            name: cleanCandidate(r.visitorName),
            email: String(r.visitorEmail ?? ""),
            phone: String(r.visitorPhone ?? ""),
            eventId: evId(r.eventId),
            eventTitle: titleOf(r.eventId),
            createdAt: iso(r.createdAt),
          });
          // Seat guests are people too: each is addressed by its chair.
          for (const g of (Array.isArray(r.seatGuests) ? r.seatGuests : []) as any[]) {
            const index = Number(g?.chairIndex);
            if (!Number.isInteger(index) || index < 0 || index > 999) continue;
            if (!g?.whatsApp && !g?.name) continue;
            out.push({
              id: `roundtables:${r._id}:${index}`,
              source,
              name: cleanCandidate(g.name),
              email: String(g.email ?? ""),
              phone: String(g.whatsApp ?? ""),
              eventId: evId(r.eventId),
              eventTitle: titleOf(r.eventId),
              createdAt: iso(r.createdAt),
            });
          }
        }
        return out;
      }
      case "workshops": {
        const rows = await this.workshopModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("visitorName visitorEmail visitorPhone eventId createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((r: any) => ({
          id: `workshops:${r._id}`,
          source,
          name: cleanCandidate(r.visitorName),
          email: String(r.visitorEmail ?? ""),
          phone: String(r.visitorPhone ?? ""),
          eventId: evId(r.eventId),
          eventTitle: titleOf(r.eventId),
          createdAt: iso(r.createdAt),
        }));
      }
      case "spaces": {
        const rows = await this.spaceModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("name email phone whatsappNumber eventId createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((r: any) => ({
          id: `spaces:${r._id}`,
          source,
          name: cleanCandidate(r.name),
          email: String(r.email ?? ""),
          phone: String(r.whatsappNumber || r.phone || ""),
          eventId: evId(r.eventId),
          eventTitle: titleOf(r.eventId),
          createdAt: iso(r.createdAt),
        }));
      }
      case "members": {
        const rows = await this.membershipModel
          .find({ organizerId: org })
          .select("exhibitorName exhibitorEmail exhibitorWhatsapp createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((r: any) => ({
          id: `members:${r._id}`,
          source,
          name: cleanCandidate(r.exhibitorName),
          email: String(r.exhibitorEmail ?? ""),
          phone: String(r.exhibitorWhatsapp ?? ""),
          eventId: null,
          eventTitle: "",
          createdAt: iso(r.createdAt),
        }));
      }
      case "rsvps": {
        // RSVPs key the event as a string and may predate `organizerId`, so
        // they are found through the organizer's own events.
        const eventIds = eventId ? [eventId] : [...events.keys()];
        if (!eventIds.length) return [];
        // RSVPs hold `eventId` as a string on older records and as an
        // ObjectId on newer ones; the schema would cast both forms to one
        // type, so this read goes through the driver to match either.
        const rows = await this.rsvpModel.collection
          .find(
            {
              eventId: {
                $in: [
                  ...eventIds,
                  ...eventIds
                    .filter((e) => OBJECT_ID.test(e))
                    .map((e) => new Types.ObjectId(e)),
                ],
              },
            },
            { projection: { name: 1, email: 1, contactNumber: 1, attendees: 1, eventId: 1, createdAt: 1 } },
          )
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        const out: Contact[] = [];
        for (const r of rows as any[]) {
          out.push({
            id: `rsvps:${r._id}`,
            source,
            name: cleanCandidate(r.name),
            email: String(r.email ?? ""),
            phone: String(r.contactNumber ?? ""),
            eventId: evId(r.eventId),
            eventTitle: titleOf(r.eventId),
            createdAt: iso(r.createdAt),
          });
          (Array.isArray(r.attendees) ? r.attendees : []).forEach((a: any, index: number) => {
            if (index > 999 || !a?.contactNumber) return;
            out.push({
              id: `rsvps:${r._id}:${index}`,
              source,
              name: cleanCandidate(a.name),
              email: "",
              phone: String(a.contactNumber ?? ""),
              eventId: evId(r.eventId),
              eventTitle: titleOf(r.eventId),
              createdAt: iso(r.createdAt),
            });
          });
        }
        return out;
      }
      case "sponsors": {
        const rows = await this.sponsorModel
          .find({ organizerId: org, ...(ev ? { eventId: ev } : {}) })
          .select("contactName companyName email businessEmail phone countryCode eventId createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((r: any) => ({
          id: `sponsors:${r._id}`,
          source,
          name: cleanCandidate(r.contactName || r.companyName),
          email: String(r.email || r.businessEmail || ""),
          phone: withCode(r.phone, r.countryCode),
          eventId: evId(r.eventId),
          eventTitle: titleOf(r.eventId),
          createdAt: iso(r.createdAt),
        }));
      }
      case "suppliers": {
        const rows = await this.supplierModel
          .find({ organizerId: org })
          .select("name companyName email businessEmail phone whatsAppNumber countryCode createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((r: any) => ({
          id: `suppliers:${r._id}`,
          source,
          name: cleanCandidate(r.name || r.companyName),
          email: String(r.email || r.businessEmail || ""),
          phone: withCode(r.whatsAppNumber || r.phone, r.countryCode),
          eventId: null,
          eventTitle: "",
          createdAt: iso(r.createdAt),
        }));
      }
      case "crm": {
        // The organizer's own customer directory (My Users → Visitors), the
        // same query the dashboard uses: rows created through the older
        // shopkeeper flow are tagged "Shopkeeper" but belong to the organizer.
        const rows = await this.userModel
          .find({ provider: { $in: ["Organizer", "Shopkeeper"] }, providerId: organizerId })
          .select("name firstName lastName email whatsAppNumber createdAt")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        return rows.map((u: any) => ({
          id: `crm:${u._id}`,
          source,
          name: cleanCandidate(
            u.name ||
              [u.firstName, u.lastName].map((p: unknown) => String(p ?? "").trim()).filter(Boolean).join(" "),
          ),
          email: String(u.email ?? ""),
          phone: String(u.whatsAppNumber ?? ""),
          eventId: null,
          eventTitle: "",
          createdAt: iso(u.createdAt),
        }));
      }
      default:
        return [];
    }
  }

  /** One contact by id, or null when it is not the organizer's. */
  async findContact(organizerId: string, contactId: string): Promise<Contact | null> {
    const id = assertOrganizerId(organizerId);
    if (!CONTACT_ID.test(String(contactId ?? ""))) return null;
    const source = String(contactId).split(":")[0] as ContactSource;
    if (source === "all" || !EVERY_SOURCE.includes(source)) return null;
    const { contacts } = await this.listContacts(id, source);
    return contacts.find((c) => c.id === contactId) ?? null;
  }

  // ── The audience ─────────────────────────────────────────────────────────

  async build(
    organizerId: string,
    dto: CampaignRequestDto,
    options: BuildOptions = {},
  ): Promise<BuiltAudience> {
    const id = assertOrganizerId(organizerId);
    assertOneAudience(dto);

    const organizer = await this.organizerModel
      .findById(id)
      .select("organizationName name country whatsAppNumber phone")
      .lean();
    if (!organizer) throw new NotFoundException("Organizer not found.");
    const country = (organizer as any).country || undefined;

    const events = await this.eventsById(id);
    const chosenEvent = dto.eventId ? events.get(dto.eventId) ?? null : null;
    if (dto.eventId && !chosenEvent) throw new NotFoundException("Event not found.");

    const { contacts, truncated } = await this.selectContacts(id, dto);
    const warnings: string[] = [];

    let imagePath: string | null = null;
    if (dto.attachEventImage) {
      if (!chosenEvent) warnings.push(IMAGE_NEEDS_EVENT_WARNING);
      else {
        const full = resolveUploadPath(chosenEvent.image);
        if (full && (await readable(full))) imagePath = chosenEvent.image;
        else warnings.push(IMAGE_MISSING_WARNING);
      }
    }
    const hasImage = !!imagePath;

    const linkBase = await this.eventLinkBase(id, organizer);
    const organizerName = String(
      (organizer as any).organizationName || (organizer as any).name || "",
    );
    const varsForEvent = (e: EventInfo | null): CampaignVars => ({
      organizer_name: organizerName,
      event: e?.title ?? "",
      event_date: e ? formatEventDate(e) : "",
      event_venue: e?.location ?? "",
      event_link: e ? `${linkBase}/${e.id}` : "",
    });
    const sharedVars = varsForEvent(chosenEvent);

    const optedOut = await this.optOutDigits(id);

    const ownDigits = new Set<string>();
    for (const own of [(organizer as any).whatsAppNumber, (organizer as any).phone]) {
      const digits = this.whatsapp.digitsFor(own, country) ?? rawDigits(own);
      if (digits) ownDigits.add(digits);
    }
    const linked = this.whatsapp.linkedNumber(id);
    if (linked) ownDigits.add(rawDigits(linked));

    const cap = hasImage ? MAX_CAPTION : MAX_TEXT;
    const seen = new Set<string>();
    const rows: AudienceRow[] = [];
    // Sendable rows and their values, so the texts can be built at the end —
    // only as many as the caller needs.
    const sendable: Array<{ row: AudienceRow; vars: CampaignVars }> = [];

    for (const contact of contacts) {
      const name = resolveContactName([contact.name], contact.email);
      // A contact with no usable name still needs a label the organizer
      // recognises. Only ever shown in the dashboard, never sent.
      const display = (name || contact.name || contact.email || "").slice(0, 60);

      const stored = String(contact.phone ?? "").trim();
      let reason: string | null = null;
      let digits: string | null = null;
      if (!stored) {
        reason = SKIP.noNumber;
      } else {
        digits = this.whatsapp.digitsFor(stored, country);
        const compare = digits ?? rawDigits(stored);
        if (compare && ownDigits.has(compare)) reason = SKIP.ownNumber;
        else if (compare && optedOut.has(compare)) reason = SKIP.optedOut;
        else if (!digits) reason = SKIP.invalid;
        else if (seen.has(digits)) reason = SKIP.duplicate;
      }

      // An event-wide campaign fills the event placeholders from the chosen
      // event; an organizer-wide one from each contact's own event, when it
      // has one.
      const eventVars = chosenEvent
        ? sharedVars
        : varsForEvent(contact.eventId ? events.get(contact.eventId) ?? null : null);
      const vars: CampaignVars = {
        ...eventVars,
        name,
        first_name: firstNameOf(name),
      };
      // Measured, not built: the length decides the skip, and the text itself
      // is only needed for the rows the caller will show or send.
      if (!reason && renderedLength(dto.template, vars, contact.id) > cap) {
        reason = SKIP.tooLong;
      }

      // Only a row that will actually be sent claims its number: a number
      // whose first row was skipped for its own message length has not been
      // messaged, so a later row for it still can be.
      if (!reason && digits) seen.add(digits);

      const row: AudienceRow = {
        contactId: contact.id,
        name: display,
        phone: reason ? stored : `+${digits}`,
        status: reason ? "skipped" : "pending",
        reason,
        sentAt: null,
        text: "",
      };
      rows.push(row);
      if (!reason) sendable.push({ row, vars });
    }

    // A campaign too big to send is refused by the caller, so its texts are
    // never needed — except a preview's few samples, which still show what
    // the message looks like while the organizer narrows the selection.
    const tooBig = truncated || sendable.length > MAX_SENDABLE;
    const texts =
      options.samples !== undefined
        ? Math.max(0, options.samples)
        : tooBig
          ? 0
          : sendable.length;
    for (const { row, vars } of sendable.slice(0, texts)) {
      row.text = render(dto.template, vars, row.contactId);
    }

    return {
      rows,
      willSend: sendable.length,
      truncated,
      hasImage,
      imagePath,
      eventId: chosenEvent?.id ?? null,
      eventTitle: chosenEvent?.title ?? "",
      warnings,
    };
  }

  /**
   * The contacts this request names, in a stable order. `contactIds` keeps
   * the order it was sent in (so the first-listed of two contacts sharing a
   * number is the one messaged); "all contacts" lists each source newest
   * first and stops at MAX_CANDIDATES per source (`truncated`). An explicit
   * list is already bounded by the request DTO, and every id is resolved
   * through the organizer-scoped reads, so a foreign id simply is not found.
   */
  private async selectContacts(
    organizerId: string,
    dto: CampaignRequestDto,
  ): Promise<{ contacts: Contact[]; truncated: boolean }> {
    const wanted = requestedSources(dto);
    // The event narrows the audience only when asked; otherwise it just
    // fills the message details (see CampaignRequestDto.filterByEvent).
    const scope = dto.filterByEvent === false ? undefined : dto.eventId;
    if (dto.allContacts) {
      return this.listContacts(organizerId, wanted, scope);
    }
    const requested = [...new Set((dto.contactIds ?? []).map(String))].filter((c) =>
      CONTACT_ID.test(c),
    );
    if (requested.length === 0) return { contacts: [], truncated: false };

    // One read per source named, each filtered the way the composer's list
    // was, so an id from a source the request did not name is not found.
    const bySource = new Map<string, Contact>();
    const sources = [...new Set(requested.map((c) => c.split(":")[0]))];
    for (const s of sources) {
      if (!EVERY_SOURCE.includes(s as ContactSource)) continue;
      if (!wanted.includes("all") && !wanted.includes(s as ContactSource)) continue;
      const { contacts } = await this.listContacts(organizerId, s as ContactSource, scope);
      for (const c of contacts) bySource.set(c.id, c);
    }
    return {
      contacts: requested
        .map((cid) => bySource.get(cid))
        .filter((c): c is Contact => !!c),
      truncated: false,
    };
  }

  /** "https://eventsh.com/<organizer slug>/events" — the same public route
   * the stall and ticket emails link to. */
  private async eventLinkBase(organizerId: string, organizer: any): Promise<string> {
    const fe = (process.env.FRONTEND_BASE_URL || "https://eventsh.com").replace(/\/+$/, "");
    try {
      const store = await this.storeModel
        .findOne({ organizerId: { $in: [organizerId, new Types.ObjectId(organizerId)] } })
        .select("slug")
        .lean();
      let slug: string | undefined = (store as any)?.slug || undefined;
      if (!slug && organizer?.organizationName) {
        slug = String(organizer.organizationName)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }
      if (slug) return `${fe}/${slug}/events`;
    } catch (err) {
      this.logger.warn(`Could not read the storefront slug for ${organizerId}: ${describe(err)}`);
    }
    return `${fe}/events`;
  }

  // ── Opt-outs ─────────────────────────────────────────────────────────────

  /** The organizer's opt-outs, as the numbers (digits) they cover. */
  async optOutDigits(organizerId: string): Promise<Set<string>> {
    const id = assertOrganizerId(organizerId);
    const optOuts = await this.optOutModel
      .find({ organizerId: id })
      .select("phoneDigits")
      .lean();
    return new Set(optOuts.map((o) => String(o.phoneDigits || "")).filter(Boolean));
  }

  /**
   * Whether this number may no longer be sent marketing, asked right before
   * each campaign message. A campaign is built once but can take days to send
   * (it pauses at the daily cap), and a person who asks the organizer to stop
   * in the meantime must not get the rest of it.
   */
  async isOptedOut(organizerId: string, phone: string): Promise<boolean> {
    const id = assertOrganizerId(organizerId);
    const digits = rawDigits(phone);
    if (!digits) return false;
    return !!(await this.optOutModel.exists({ organizerId: id, phoneDigits: digits }));
  }

  async listOptOuts(organizerId: string) {
    const id = assertOrganizerId(organizerId);
    const rows = await this.optOutModel
      .find({ organizerId: id })
      .select("phoneDigits contactId name createdAt")
      .sort({ createdAt: -1 })
      .lean();
    return {
      phoneDigits: rows.map((r) => String(r.phoneDigits)),
      contacts: rows.map((r) => ({
        contactId: String(r.contactId || ""),
        name: String(r.name || ""),
        phone: maskPhone(String(r.phoneDigits)),
        createdAt: r.createdAt ?? null,
      })),
    };
  }

  /**
   * The campaign screen's "Marketing messages" switch. Stores the NUMBER the
   * contact has right now, normalised the way sending normalises it, so the
   * same person under another record is covered too.
   */
  async setOptOut(
    organizerId: string,
    contactId: string,
    optedOut: boolean,
  ): Promise<{ contactId: string; optedOut: boolean; phoneDigits: string | null }> {
    const id = assertOrganizerId(organizerId);
    const contact = await this.findContact(id, contactId);
    if (!contact) throw new NotFoundException("Contact not found.");
    const organizer = await this.organizerModel.findById(id).select("country").lean();
    const digits =
      this.whatsapp.digitsFor(contact.phone, (organizer as any)?.country) ??
      rawDigits(contact.phone);
    if (!digits) {
      throw new BadRequestException("This contact has no WhatsApp number to opt out.");
    }
    if (!optedOut) {
      await this.optOutModel.deleteOne({ organizerId: id, phoneDigits: digits });
      return { contactId, optedOut: false, phoneDigits: digits };
    }
    await this.optOutModel.updateOne(
      { organizerId: id, phoneDigits: digits },
      {
        $set: { contactId, name: contact.name },
        $setOnInsert: { organizerId: id, phoneDigits: digits },
      },
      { upsert: true },
    );
    return { contactId, optedOut: true, phoneDigits: digits };
  }
}

/** Exactly one of `contactIds` / `allContacts` — a rule across two fields,
 * which class-validator cannot express on either one. */
export function assertOneAudience(dto: CampaignRequestDto) {
  const hasIds = dto.contactIds !== undefined && dto.contactIds !== null;
  const all = dto.allContacts === true;
  if (hasIds === all) {
    throw new BadRequestException(
      "Choose the contacts to send to, or send to all contacts.",
    );
  }
}

export function assertOrganizerId(organizerId: string): string {
  const id = String(organizerId ?? "");
  if (!OBJECT_ID.test(id)) throw new BadRequestException("Invalid organizer id.");
  return id;
}

/** "12 Oct 2026, 6:00 PM" — how `{{event_date}}` reads. */
function formatEventDate(e: EventInfo): string {
  if (!e.startDate || Number.isNaN(e.startDate.getTime())) return "";
  const date = e.startDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return e.time ? `${date}, ${e.time}` : date;
}

function rawDigits(phone: unknown): string {
  return String(phone ?? "").replace(/\D/g, "");
}

async function readable(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function describe(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/\d{7,}/g, (d) => `…${d.slice(-4)}`);
}
