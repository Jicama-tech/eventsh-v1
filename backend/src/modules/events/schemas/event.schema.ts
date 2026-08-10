import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventDocument = Event & Document;

class VenueConfig {
  @Prop()
  venueConfigId: string;

  @Prop()
  width: number;

  @Prop()
  height: number;

  @Prop()
  scale: number;

  @Prop()
  gridSize: number;

  @Prop()
  showGrid: boolean;

  @Prop()
  hasMainStage: boolean;

  // Free-text front-of-house label shown on the canvas banner when
  // hasMainStage is on — "Main Stage" for a gala, "Screen" for a movie,
  // "Stage" for a concert, or anything else the organizer wants.
  @Prop({ default: "Main Stage" })
  mainStageLabel?: string;

  @Prop({ default: "rectangle" })
  mainStageShape?: string;

  @Prop({ default: 200 })
  mainStageWidth?: number;

  @Prop({ default: 60 })
  mainStageHeight?: number;

  // Undefined = default centered-at-top position (computed on the fly from
  // width/mainStageWidth) — set once the organizer drags it anywhere else.
  @Prop()
  mainStageX?: number;

  @Prop()
  mainStageY?: number;

  @Prop()
  totalRows?: number;

  // When false, this venue is hidden from the public eventfront and the
  // vendor/round-table selection tabs. Undefined = published (legacy venues
  // stay visible).
  @Prop({ default: true })
  published?: boolean;
}

class SpeakerSlotTemplate {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop() startTime: string;
  @Prop() endTime: string;
  @Prop({ default: false }) isMainStage: boolean;
  @Prop({ default: 200 }) width: number;
  @Prop({ default: 100 }) height: number;
  @Prop({ default: 0 }) slotPrice: number;
  @Prop({ default: 1 }) maxSpeakers: number;
  @Prop({ default: 0 }) maxVisitors: number;
  @Prop() description: string;
  @Prop() assignedSpeakerId: string;
  @Prop() assignedSpeakerName: string;
  @Prop({ default: true }) openForApplications: boolean;
}

class PositionedSpeakerZone {
  @Prop({ required: true }) positionId: string;
  @Prop({ required: true }) templateId: string;
  @Prop({ required: true }) name: string;
  @Prop() startTime: string;
  @Prop() endTime: string;
  @Prop({ default: false }) isMainStage: boolean;
  @Prop() width: number;
  @Prop() height: number;
  @Prop() x: number;
  @Prop() y: number;
  @Prop({ default: 0 }) rotation: number;
  @Prop({ default: true }) isPlaced: boolean;
  @Prop() venueConfigId: string;
  @Prop() assignedSpeakerId: string;
  @Prop() assignedSpeakerName: string;
}

class VisitorFeatureAccess {
  @Prop() food: boolean;
  @Prop() parking: boolean;
  @Prop() wifi: boolean;
  @Prop() photography: boolean;
  @Prop() security: boolean;
  @Prop() accessibility: boolean;
}

class VisitorType {
  @Prop() id: string;
  @Prop() name: string;
  @Prop() price: number;
  @Prop() maxCount?: number;
  @Prop() description?: string;
  @Prop({ type: Object }) featureAccess: VisitorFeatureAccess;
  @Prop({ default: true }) isActive: boolean;
}

// A declared seat row (e.g. "VIP Row") defined on the Seating tab — self-
// contained pricing (no VisitorType dependency): a label, its own price, and
// a color. Declaring a row does NOT place any seats and has no seat cap —
// however many PositionedSeat entries end up tagged with this row's id
// (placed one at a time or in bulk via the drag-to-draw tool) IS the row's
// seat count, counted live rather than pre-declared.
class SeatRowTemplate {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true, min: 0 }) price: number;
  @Prop({ default: "#8B5CF6" }) color: string;
}

// One individual seat placed on the venue canvas, freely positioned (not
// confined to a straight box) — booked ones are tracked by `id` directly in
// Event.seatMapBookedSeats. Pricing/name resolve live via `rowId` against
// SeatRowTemplate — never snapshotted onto the seat itself.
class PositionedSeat {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) rowId: string;
  @Prop({ required: true }) seatNumber: number;
  @Prop({ default: "#8B5CF6" }) color: string;
  // Optional organizer-given name (e.g. "VIP-1", a sponsor's reserved
  // seat) — falls back to `${row.name}${seatNumber}` everywhere when unset.
  @Prop() name?: string;
  @Prop() x: number;
  @Prop() y: number;
  // Degrees, set when this seat was placed by the drag-to-draw-a-row tool
  // along a tilted line (real curved/theater-style rows) — undefined/0 for
  // seats placed one at a time, which stay upright.
  @Prop() rotation?: number;
  @Prop() venueConfigId: string;
}

/**
 * A sponsorship tier the organizer offers for this event (Gold / Silver /
 * Community, etc.). Deliberately minimal — a name, what it costs, and what
 * the sponsor gets. Distinct from `Event.sponsors`, which is just the list of
 * logo URLs shown in the eventfront marquee.
 */
class SponsorType {
  @Prop() id: string;
  @Prop() name: string;
  @Prop() price: number;
  @Prop() description?: string;
  @Prop({ default: true }) isActive: boolean;
  // When false, this tier isn't paid — the sponsor picks from
  // `customOptions` (vouchers, coupons, etc.) instead of being charged, up
  // to the value of `price` (shown to sponsors the same way a price is).
  @Prop({ default: true }) collectPayment: boolean;
  @Prop({ type: [String], default: [] }) customOptions?: string[];
}

class SpeakerSlot {
  @Prop({ required: true })
  topic: string;

  @Prop()
  startTime: string;

  @Prop()
  endTime: string;

  @Prop()
  description: string;
}

class Speaker {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  title: string;

  @Prop()
  organization: string;

  @Prop()
  bio: string;

  @Prop()
  image: string;

  @Prop()
  email: string;

  @Prop({
    type: Object,
    default: { linkedin: "", twitter: "", website: "" },
  })
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };

  @Prop({ type: [Object], default: [] })
  slots: SpeakerSlot[];

  @Prop({ default: false })
  isKeynote: boolean;

  @Prop({ default: 0 })
  order: number;
}

class WorkshopSession {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  image: string;

  // Price a visitor pays to attend this workshop individually.
  @Prop({ default: 0 })
  price: number;

  @Prop()
  facilitator: string;

  @Prop()
  startTime: string;

  @Prop()
  endTime: string;

  @Prop({ default: 0 })
  maxSeats: number;

  // How many seats are already confirmed-paid against maxSeats. Only
  // incremented on booking confirmation, same as round tables' bookedChairs
  // — a Pending/Submitted booking does not yet hold a seat.
  @Prop({ default: 0 })
  bookedSeats: number;

  @Prop({ default: 0 })
  order: number;
}

class WorkshopPackage {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  // Bundle price — what a visitor pays for all included sessions together.
  @Prop({ default: 0 })
  price: number;

  // Ids of WorkshopSession entries bundled into this package.
  @Prop({ type: [String], default: [] })
  sessionIds: string[];

  @Prop({ default: 0 })
  order: number;
}

class RoundTableTemplate {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  // Allow 0 — a standing table has no chairs. Upper bound widened to 30.
  @Prop({ required: true, min: 0, max: 30 }) numberOfChairs: number;
  @Prop({ required: true, enum: ["table", "chair"] }) sellingMode: string;
  @Prop({ default: 0 }) tablePrice: number;
  @Prop({ default: 0 }) chairPrice: number;
  @Prop({ default: 0 }) bookingPrice: number;
  @Prop({ default: 0 }) depositPrice: number;
  // Optional member-tier pricing (mirrors the Spaces model). Undefined means
  // members pay the regular price for that field.
  @Prop() memberTablePrice?: number;
  @Prop() memberChairPrice?: number;
  @Prop() memberBookingPrice?: number;
  @Prop() memberDepositPrice?: number;
  @Prop({ default: "Standard" }) category: string;
  @Prop({ default: "#8B5CF6" }) color: string;
  @Prop({ default: 120 }) tableDiameter: number;
  // A "not for sale" table is a layout reference only (e.g. a standing
  // cocktail table / decoration) and cannot be booked.
  @Prop({ default: true }) forSale: boolean;
}

class PositionedRoundTable {
  @Prop({ required: true }) positionId: string;
  @Prop({ required: true }) templateId: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true, min: 0, max: 30 }) numberOfChairs: number;
  @Prop({ required: true, enum: ["table", "chair"] }) sellingMode: string;
  @Prop({ default: 0 }) tablePrice: number;
  @Prop({ default: 0 }) chairPrice: number;
  @Prop({ default: 0 }) bookingPrice: number;
  @Prop({ default: 0 }) depositPrice: number;
  @Prop() memberTablePrice?: number;
  @Prop() memberChairPrice?: number;
  @Prop() memberBookingPrice?: number;
  @Prop() memberDepositPrice?: number;
  @Prop({ default: "Standard" }) category: string;
  @Prop({ default: "#8B5CF6" }) color: string;
  @Prop({ default: 120 }) tableDiameter: number;
  @Prop({ default: true }) forSale: boolean;
  @Prop() x: number;
  @Prop() y: number;
  @Prop({ default: 0 }) rotation: number;
  @Prop({ default: true }) isPlaced: boolean;
  @Prop() venueConfigId: string;
  @Prop({ type: [Number], default: [] }) bookedChairs: number[];
  @Prop({ default: false }) isFullyBooked: boolean;
}

// A single bookable occurrence of a Scheduled Space — a specific calendar
// date + time window. Capacity is always exclusive (one booking takes the
// whole space for that slot), so there's no seat/chair count here.
class ScheduleSlot {
  @Prop({ required: true }) id: string;
  @Prop() label?: string;
  @Prop({ required: true }) date: string; // "2026-08-20"
  @Prop({ required: true }) startTime: string; // "10:00"
  @Prop({ required: true }) endTime: string; // "11:00"
}

// A Scheduled Space is a bookable facility (tennis court, cricket ground,
// chess court, ...) — NOT a sellable/rentable "space" in the Stalls sense.
// Unified across both shapes (no separate rect/round template types) so the
// organizer picks a facility type + shape from one form, not two parallel
// sections. Pricing is a single per-slot price (no booking/deposit tiers —
// those belong to the Stalls vendor-deposit workflow, not a court booking).
class ScheduledSpaceTemplate {
  @Prop({ required: true }) id: string;
  // e.g. "Tennis Court", "Cricket Ground" — from a curated list on the
  // frontend, or a custom value when the organizer picks "Other".
  @Prop({ required: true }) facilityType: string;
  // Instance label, e.g. "Court 1" — distinguishes multiple facilities of
  // the same type.
  @Prop({ required: true }) name: string;
  @Prop({ enum: ["Rectangle", "Circle"], default: "Rectangle" })
  shape: string;
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop() diameter?: number;
  @Prop({ default: 0 }) price: number;
  @Prop() color?: string;
  @Prop({ type: [Object], default: [] }) slots: ScheduleSlot[];
  // Operator (organizer staff account) this space belongs to. Unset = the
  // space is public — visible to every visitor with no referral code
  // needed. Set = only visible to visitors who enter that operator's
  // referral code (see ScheduledSpacesService.getAvailableSpaces).
  @Prop() operatorId?: string;
}

// Placed Scheduled Space instance on the venue canvas.
class PositionedScheduledSpace {
  @Prop({ required: true }) positionId: string;
  @Prop({ required: true }) templateId: string;
  @Prop({ required: true }) facilityType: string;
  @Prop({ required: true }) name: string;
  @Prop({ enum: ["Rectangle", "Circle"], default: "Rectangle" })
  shape: string;
  @Prop() width?: number;
  @Prop() height?: number;
  @Prop() diameter?: number;
  @Prop() displayWidth?: number;
  @Prop() displayHeight?: number;
  @Prop({ default: 0 }) price: number;
  @Prop() color?: string;
  @Prop({ type: [Object], default: [] }) slots: ScheduleSlot[];
  @Prop() x: number;
  @Prop() y: number;
  @Prop({ default: 0 }) rotation: number;
  @Prop({ default: true }) isPlaced: boolean;
  @Prop() venueConfigId: string;
  // Copied from the template at placement time — see note above.
  @Prop() operatorId?: string;
}

class termsAndConditionsforStalls {
  @Prop()
  termsAndConditionsforStalls: string;

  @Prop()
  isMandatory: boolean;
}

class Volunteer {
  @Prop() name: string;
  @Prop() email: string;
  @Prop() phoneNumber?: string;
}

// A single ceremony within a Personal/Marriage event (e.g. Mehndi, Sangeet,
// Wedding, Reception). Each carries its own schedule, venue and dress code.
// Dates/times are kept as plain strings (the form derives the event-level
// startDate/endDate from these).
class MarriageFunction {
  @Prop() id: string;
  @Prop() name: string;
  @Prop() date?: string;
  @Prop() time?: string;
  @Prop() endTime?: string;
  @Prop() venueName?: string;
  @Prop() address?: string;
  @Prop() dressCode?: string;
  @Prop() notes?: string;
  // Running order WITHIN this ceremony: what's included, when and where. Each
  // item is { id, time, title, location }. `location` falls back to venueName.
  @Prop({ type: [Object], default: undefined })
  timeline?: { id: string; time?: string; title?: string; location?: string }[];
  // Lodging info specific to THIS ceremony's location — for weddings where
  // functions are on different dates/cities (e.g. a Roka elsewhere). Falls
  // back to the event-level marriage.accommodations when empty.
  @Prop() accommodation?: string;
  // Set true when the organizer announces this ceremony has started — drives
  // the "live" announcement bar on the public wedding page.
  @Prop({ default: false }) isLive?: boolean;
  // ISO timestamp of the most recent "has started" announcement.
  @Prop() announcedAt?: string;
}

// Couple + story details specific to a Marriage event.
class MarriageDetails {
  @Prop() partner1Name?: string;
  @Prop() partner2Name?: string;
  // Custom heading shown on the eventfront RSVP/invitation form. Falls back to
  // the couple names / event title when empty.
  @Prop() invitationTitle?: string;
  @Prop() hostNames?: string;
  @Prop() contactName?: string;
  @Prop() contactPhone?: string;
  @Prop() contactEmail?: string;
  @Prop() ourStory?: string;
  @Prop() howWeMet?: string;
  // "Our Story" rendered as an image timeline on the public wedding page. Each
  // moment carries a title, an optional date, rich-text (Quill HTML) content
  // and an optional image URL. Organizers can add unlimited moments. Replaces
  // the single `ourStory` string (which stays as a legacy fallback).
  @Prop({ type: [Object], default: undefined })
  storyTimeline?: {
    id: string;
    title?: string;
    date?: string;
    content?: string;
    image?: string;
  }[];
  // Lodging suggestions shown to guests + included in the RSVP email.
  @Prop() accommodations?: string;
  // Other guest logistics (travel, gifts, parking, etc.).
  @Prop() additionalInfo?: string;
  // Customization for the "function has started" announcement bar on the
  // public wedding page. Colors fall back to the theme; message is an optional
  // override (supports {function} / {venue} / {time} placeholders).
  @Prop() adBarBgColor?: string;
  @Prop() adBarTextColor?: string;
  @Prop() adBarMessage?: string;
  // Eventfront "Site Settings" — colors/font/hero chosen by the organizer to
  // personalize the public wedding page. Free-form object; shape mirrors the
  // frontend MarriageTheme (see frontend/src/lib/marriageThemes.ts).
  @Prop({ type: Object }) theme?: Record<string, any>;
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  // Organizer-chosen URL identifier — when set, the public eventfront link
  // uses this instead of the raw Mongo _id (e.g. /org-slug/events/my-event
  // instead of /org-slug/events/671f...). Unique per organizer, not
  // globally — two different organizers may pick the same slug (the
  // eventfront route already carries the organizer's own slug, so there's
  // no real ambiguity there). Left unset, everything works exactly as
  // before (falls back to the _id). Enforced via a sparse compound index
  // below so events without a slug never collide with each other.
  @Prop({ trim: true, lowercase: true })
  slug?: string;

  // Top-level event grouping picked in the "Create Event" pre-step. The
  // chosen sub-type is stored in `category`; this records which family it
  // belongs to. Optional/loosely enumerated so events created before this
  // field existed stay valid.
  @Prop({ enum: ["commercial", "personal"] })
  eventType?: string;

  // ── Landing-page showcase / demo ──────────────────────────────────────
  // Admin-created demo events used to show off the product on the public
  // landing page. `isShowcase` surfaces the event in the landing "See it in
  // action" grid; `isDemo` puts its public eventfront into demo mode (every
  // buy/RSVP/book action opens a "Register / Contact Us" prompt instead of
  // performing the real action). Both default false so real events are
  // unaffected.
  @Prop({ default: false })
  isShowcase?: boolean;

  @Prop({ default: false })
  isDemo?: boolean;

  @Prop({ enum: ["professional", "personal"] })
  showcaseKind?: string;

  // What the landing entry points expose for this demo: just the public event
  // page, the (read-only) organizer dashboard, or both.
  @Prop({ enum: ["eventfront", "dashboard", "both"], default: "eventfront" })
  showcaseMode?: string;

  @Prop({ default: 0 })
  showcaseOrder?: number;

  @Prop()
  showcaseBlurb?: string;

  // Ceremonies for a Personal/Marriage event. Generic top-level array so other
  // multi-part personal events can reuse it later. Empty for commercial events.
  @Prop({ type: [Object], default: [] })
  functions?: MarriageFunction[];

  // Wedding-only couple/story details. Undefined for non-marriage events.
  @Prop({ type: Object, default: undefined })
  marriage?: MarriageDetails;

  @Prop()
  category?: string;

  // Multi-select categories. `category` (singular) is kept in sync with the
  // first entry so the many existing read-sites that display `event.category`
  // continue to work without per-call migration.
  @Prop({ type: [String], default: undefined })
  categories?: string[];

  @Prop()
  startDate: Date;

  @Prop()
  time?: string;

  @Prop()
  endDate?: Date;

  @Prop()
  endTime?: string;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizer: Types.ObjectId;

  @Prop()
  location?: string;

  @Prop()
  address?: string;

  @Prop()
  ticketPrice?: string;

  @Prop()
  totalTickets?: number;

  @Prop()
  originalTotalTickets?: number;

  @Prop({ enum: ["public", "private", "unlisted"], default: "public" })
  visibility: string;

  @Prop()
  inviteLink?: string;

  @Prop([String])
  tags: string[];

  @Prop({
    type: Object,
    default: {
      food: false,
      parking: false,
      wifi: false,
      photography: false,
      security: false,
      accessibility: false,
    },
  })
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
    // Venue Setup "Event Sections" switches — which category modules this
    // event uses. Persisted here too (Mixed type accepts extra keys) even
    // though only the six amenity flags above are declared by default.
    hasStalls?: boolean;
    hasSpeakers?: boolean;
    hasRoundTables?: boolean;
    hasWorkshops?: boolean;
    hasScheduledSpaces?: boolean;
  };

  @Prop()
  ageRestriction?: string;

  // Custom, per-purpose age restrictions — the organizer names each one
  // (e.g. "Vendors", "Round Tables", "General") and picks the age. Optional;
  // the single `ageRestriction` above stays as the overall/default.
  @Prop({ type: [Object], default: [] })
  ageRestrictions?: { heading: string; age: string }[];

  @Prop()
  dresscode?: string;

  // Organizer-specified custom theme that goes with the dress code
  @Prop()
  dressCodeTheme?: string;

  @Prop()
  specialInstructions?: string;

  @Prop()
  refundPolicy?: string;

  @Prop()
  termsAndConditions?: string;

  // Free-form custom sections — each one is a heading + a Quill
  // HTML body. Renders inside the eventfront's "Additional
  // Information" collapsible alongside the fixed sections (special
  // instructions, refund policy, terms & conditions) so organizers
  // can add ad-hoc info (e.g. "Parking notes", "Dress code details",
  // "Sponsor message") without us shipping a new field every time.
  // Loose Array of Object — small, stable shape, no need for a
  // dedicated subdocument class.
  @Prop({ type: [Object], default: [] })
  customSections?: {
    id: string;
    heading: string;
    content: string;
  }[];

  // Per-section visibility on the eventfront. Keys: "ageDress",
  // "specialInstructions", "refundPolicy", "termsAndConditions", and each
  // custom section's id. A missing key means visible (so existing events
  // keep showing everything); explicit `false` hides that section.
  @Prop({ type: Object, default: {} })
  sectionVisibility?: Record<string, boolean>;

  // Per-field visibility on the four public application forms (Stall,
  // Speaker, Round Table, Workshop). Same "missing key = enabled"
  // convention as sectionVisibility above. Only fields that aren't
  // required at the schema/DTO level (or hardcoded required by frontend
  // validation) are ever toggled off — see
  // frontend/src/lib/registrationFormFields.ts for the canonical list.
  @Prop({ type: Object, default: {} })
  registrationFormFields?: {
    stall?: Record<string, boolean>;
    speaker?: Record<string, boolean>;
    roundTable?: Record<string, boolean>;
    workshop?: Record<string, boolean>;
    scheduledSpace?: Record<string, boolean>;
  };

  @Prop()
  setupTime?: string;

  @Prop()
  breakdownTime?: string;

  // Media fields
  @Prop()
  image?: string;

  @Prop([String])
  gallery?: string[];

  // Event sponsor logo image URLs. Shown on the eventfront below the banner as
  // a moving logo carousel. No fixed limit.
  @Prop({ type: [String], default: [] })
  sponsors?: string[];

  // Whether the sponsor ad bar renders on the eventfront at all. Confirmed
  // sponsors' logos flow into it automatically, so this is the organizer's
  // switch for showing the strip publicly. Legacy events have no value —
  // the eventfront treats only an explicit `false` as hidden.
  @Prop({ default: true })
  showSponsorBar?: boolean;

  // Instagram reel URLs (e.g. https://www.instagram.com/reel/<id>/).
  // Surfaced as a carousel on the eventfront; clicking a tile opens
  // the official Instagram /embed iframe inside a dialog so the reel
  // plays without leaving the page. Capped at 10 client-side; we keep
  // it loose here so a legacy event with one stray entry isn't blocked.
  @Prop([String])
  reelLinks?: string[];

  // Announcement / "Ad Bar" — same shape as the kioscart-v1
  // storefront's adBar so the eventfront can render the matching
  // marquee strip at the top of the page. Single object (not an
  // array) — one bar per event. Toggle off by setting `visible` to
  // false rather than deleting fields, so colors persist across
  // edits. All fields optional so legacy events without an ad bar
  // skip the render entirely.
  @Prop({
    type: Object,
    default: { visible: false, message: "", bgColor: "", textColor: "" },
  })
  adBar?: {
    visible?: boolean;
    message?: string;
    bgColor?: string;
    textColor?: string;
  };

  @Prop({
    type: Object,
    default: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
  })
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };

  // Max total spaces a single vendor may request/book across all space types.
  // Drives the quantity-based preferred-space picker on the stall form and the
  // total cap when the vendor selects real spaces on the layout. Default 1.
  @Prop({ type: Number, default: 1 })
  maxSpacesPerVendor?: number;

  // When false, no coupon is created when a stall payment is confirmed —
  // the vendor's confirmation email/PDF won't include a free-entry code.
  @Prop({ default: true })
  autoGenerateVendorCoupon?: boolean;

  // When false, hides space prices from the eventfront venue-map tooltip AND
  // hides the space-template color legend below the map. Defaults to true
  // (existing behavior — prices always shown) so this is non-breaking.
  @Prop({ default: true })
  showSpacePricesOnEventfront?: boolean;

  // Exhibition/Venue fields with ROW-BASED PRICING
  @Prop({ type: Array, default: [] })
  tableTemplates: {
    id: string;
    name: string;
    type: "Straight";
    width: number;
    height: number;
    rowNumber?: number; // NEW: Row number for pricing
    tablePrice: number; // NEW: Full table rental price
    bookingPrice: number; // NEW: Partial payment (must be <= tablePrice)
    depositPrice: number;
    // Member-tier pricing — populated only when the organizer's
    // subscription has the `membership` module enabled. Optional fall-
    // through: when unset (legacy templates or members-disabled plans),
    // every exhibitor pays the regular tablePrice/bookingPrice/deposit.
    memberPrice?: number;
    memberBookingPrice?: number;
    memberDepositPrice?: number;
    color?: string;
    forSale?: boolean;
    isBooked: boolean;
    bookedBy?: string;
    customDimensions?: boolean;
  }[];

  @Prop({ type: Array, default: [] })
  venueTables: {
    venueConfigId: string;
    tableName: string;
    positionId: string;
    id: string;
    name: string;
    type: "Straight";
    width: number;
    height: number;
    // Layout-only overrides written by the venue-designer corner
    // resize handles. Receipts, the exhibitor size pill, and any
    // billing read `width`/`height` (the template-authored size);
    // only the rendered canvas footprint follows the overrides.
    displayWidth?: number;
    displayHeight?: number;
    x: number;
    y: number;
    rotation: number;
    isPlaced: boolean;
    rowNumber?: number;
    tablePrice: number;
    bookingPrice: number;
    depositPrice: number;
    // Same dual-tier pricing carried through to placed spaces so the
    // booking flow can resolve member vs non-member at runtime without
    // re-walking the template list.
    memberPrice?: number;
    memberBookingPrice?: number;
    memberDepositPrice?: number;
    // Exhibitor business categories this space is reserved for.
    // Empty / unset = open to every category. Multiple values supported
    // (multi-select picker on the designer side). `exhibitorCategory`
    // (singular) stays for legacy reads.
    exhibitorCategories?: string[];
    exhibitorCategory?: string;
    color?: string;
    forSale?: boolean;
    isBooked: boolean;
    bookedBy?: string;
  }[];

  @Prop({ type: Array, default: [] })
  addOnItems: {
    id: string;
    name: string;
    price: number;
    description: string;
    addOnImage?: string;
    /** Hex color used to mark the add-on on the venue layout (one dot per
     *  purchased add-on on each booked stall). Defaults to a neutral grey. */
    color?: string;
    /** Cap on how many of this add-on a vendor may pick per booked space.
     *  Undefined / 0 = unlimited. */
    maxPerSpace?: number;
    /** Per-space-template caps: templateId → max count. Overrides maxPerSpace
     *  for that template. */
    maxPerTemplate?: Record<string, number>;
  }[];

  @Prop({
    type: [Object],
    default: [
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
  })
  venueConfig: VenueConfig[];

  @Prop({ enum: ["draft", "published", "cancelled"], default: "draft" })
  status: string;

  // Public-link kill switch driven by the My Events "Publish" toggle. When
  // false, the public eventfront refuses to render even if someone has the
  // link. Defaults true so existing events stay visible (non-breaking).
  @Prop({ default: true })
  published: boolean;

  @Prop({ default: false })
  featured: boolean;

  // Public Eventfront AI assistant. When `enabled`, a floating chat widget
  // appears on the event's public page so visitors, vendors, speakers and
  // round-table guests can ask questions grounded in THIS event's data. The
  // organizer toggles it on/off and picks a display `name` in the Create/Edit
  // Event form. Undefined (legacy events) is treated as disabled.
  @Prop({
    type: Object,
    default: { enabled: false, name: "Event Assistant", accentColor: "#2563eb" },
  })
  chatbot?: {
    enabled?: boolean;
    name?: string;
    // Theme colour for the widget (header, launcher bubble, user messages,
    // send button). Falls back to the storefront primary colour, then a
    // default blue, when unset.
    accentColor?: string;
  };

  @Prop({ type: [Object], default: [] })
  speakerSlotTemplates: SpeakerSlotTemplate[];

  @Prop({ type: [Object], default: [] })
  venueSpeakerZones: PositionedSpeakerZone[];

  @Prop({ type: [Object], default: [] })
  visitorTypes: VisitorType[];

  // Cinema/concert-style assigned seating (Event Sections toggle:
  // features.hasSeating). Templates are defined on the Seating tab and
  // placed onto the venue canvas like round tables/stalls; when none are
  // placed, ticketing falls back to the plain visitorTypes picker above
  // with no other code change.
  @Prop({ type: [Object], default: [] })
  seatRowTemplates?: SeatRowTemplate[];

  @Prop({ type: Array, default: [] })
  venueSeats?: PositionedSeat[];

  @Prop({ type: [String], default: [] })
  seatMapBookedSeats?: string[];

  // Sponsorship tiers on offer. Businesses apply against one of these from
  // the eventfront; see the `sponsors` module for the applications themselves.
  @Prop({ type: [Object], default: [] })
  sponsorTypes: SponsorType[];

  @Prop({ type: [Object], default: [] })
  speakers: Speaker[];

  @Prop({ type: [Object], default: [] })
  workshopSessions: WorkshopSession[];

  @Prop({ type: [Object], default: [] })
  workshopPackages: WorkshopPackage[];

  // Public "Host a Workshop" self-application entry point on the eventfront.
  // Off by default — the organizer opts in per event, same as hasSpeakers/
  // hasRoundTables gate their respective sections.
  @Prop({ default: false })
  workshopHostingOpen: boolean;

  @Prop({ type: [Object], default: [] })
  termsAndConditionsforStalls?: termsAndConditionsforStalls[];

  // Round Table Seating (charity dinners, galas, etc.)
  @Prop({ type: Array, default: [] })
  roundTableTemplates: RoundTableTemplate[];

  @Prop({ type: Array, default: [] })
  venueRoundTables: PositionedRoundTable[];

  // Scheduled Spaces (Event Sections toggle: features.hasScheduledSpaces) —
  // bookable facilities (tennis court, cricket ground, ...) sold per time
  // slot rather than once for the whole event. Templates are defined on the
  // Schedule tab and placed onto the venue canvas like Spaces/Round Tables.
  @Prop({ type: Array, default: [] })
  scheduledSpaceTemplates: ScheduledSpaceTemplate[];

  @Prop({ type: Array, default: [] })
  venueScheduledSpaces: PositionedScheduledSpace[];

  // Atomic per-(instance,slot) reservation ledger — same proven technique as
  // seatMapBookedSeats above. Tokens: `${positionId}:${slotId}`.
  @Prop({ type: [String], default: [] })
  scheduledSpaceBookedSlots?: string[];

  // Placed entrance / exit doors. Each entry carries its own
  // venueConfigId so multi-config layouts can group them per venue at
  // render time. Loose shape (Array of Object) because the door schema
  // is small and stable enough not to warrant a typed subdocument.
  @Prop({ type: [Object], default: [] })
  venueDoors: {
    id: string;
    venueConfigId?: string;
    type: "entrance" | "exit";
    label?: string;
    x: number;
    y: number;
    rotation?: number;
    // Shape + footprint of the door. Square doors are user-resizable
    // via 8 corner/edge handles in the designer; circles render at the
    // legacy 50×50 footprint when width/height are absent.
    shape?: "circle" | "square";
    width?: number;
    height?: number;
  }[];

  // CAD-style annotations drawn on the venue canvas (lines, text labels,
  // rectangles/zone boxes, dimension lines). Tagged with venueConfigId so
  // each layout keeps its own drawings. Free-form enough not to warrant a
  // typed subdocument.
  @Prop({ type: [Object], default: [] })
  venueAnnotations: {
    id: string;
    venueConfigId?: string;
    type: "line" | "text" | "rect" | "dimension";
    points?: number[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    text?: string;
    color?: string;
    fill?: string;
    strokeWidth?: number;
    fontSize?: number;
  }[];

  // Volunteers allow-listed to sign in to the operator scanner via Google.
  // Match is on `email` (lowercased) — name and phoneNumber are for the
  // organizer's records.
  @Prop({ type: [Object], default: [] })
  volunteers: Volunteer[];

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Partial (not sparse) so events with no slug never collide with each
// other under the unique constraint. `sparse` alone doesn't do this for a
// COMPOUND key: MongoDB only skips a sparse index entry when EVERY field
// in the key is missing, and `organizer` is always present here — so a
// merely-sparse version of this index would try to index every slugless
// event too, with `slug` read as null, and any two of an organizer's
// events without a slug would collide as "duplicates." A partial filter
// restricts the index to documents that actually have a slug, which is
// what was actually intended.
EventSchema.index(
  { organizer: 1, slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $exists: true } } },
);
