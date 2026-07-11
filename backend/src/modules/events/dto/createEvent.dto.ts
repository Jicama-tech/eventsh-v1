import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsUrl,
  IsBoolean,
  IsEnum,
  ValidateNested,
  IsNumber,
  IsObject,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export enum Visibility {
  PUBLIC = "public",
  PRIVATE = "private",
  UNLISTED = "unlisted",
}

export enum EventStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  CANCELLED = "cancelled",
}

export class SocialMediaDto {
  @IsUrl()
  @IsOptional()
  facebook?: string;

  @IsUrl()
  @IsOptional()
  instagram?: string;

  @IsUrl()
  @IsOptional()
  twitter?: string;

  @IsUrl()
  @IsOptional()
  linkedin?: string;
}

export class FeaturesDto {
  @IsBoolean()
  @IsOptional()
  food?: boolean;

  @IsBoolean()
  @IsOptional()
  parking?: boolean;

  @IsBoolean()
  @IsOptional()
  wifi?: boolean;

  @IsBoolean()
  @IsOptional()
  photography?: boolean;

  @IsBoolean()
  @IsOptional()
  security?: boolean;

  @IsBoolean()
  @IsOptional()
  accessibility?: boolean;
}

// Table templates (row-based pricing)
export class TableTemplateDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  type: "Straight";

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  rowNumber?: number;

  @IsNumber()
  @Min(0)
  tablePrice: number;

  @IsNumber()
  @Min(0)
  bookingPrice: number;

  @IsNumber()
  @Min(0)
  depositPrice: number;

  @IsBoolean()
  @IsOptional()
  isBooked?: boolean;

  @IsString()
  @IsOptional()
  bookedBy?: string;

  @IsBoolean()
  @IsOptional()
  customDimensions?: boolean;
}

export class termsAndConditionsforStalls {
  @IsString()
  termsAndConditionsforStalls: string;

  @IsBoolean()
  isMandatory: boolean;
}

// Positioned tables (extends template)
export class PositionedTableDto extends TableTemplateDto {
  @IsString()
  positionId: string;

  @IsString()
  tableName: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  rotation: number;

  @IsBoolean()
  isPlaced: boolean;

  @IsString()
  venueConfigId: string;
}

// Add-on items
export class AddOnItemDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsString()
  @IsOptional()
  addOnImage?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  maxPerSpace?: number;

  @IsOptional()
  maxPerTemplate?: Record<string, number>;
}

// Venue configs (now array, includes venueConfigId)
export class VenueConfigDto {
  @IsString()
  venueConfigId: string;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsNumber()
  scale: number;

  @IsNumber()
  gridSize: number;

  @IsBoolean()
  showGrid: boolean;

  @IsBoolean()
  hasMainStage: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  totalRows?: number;

  // Door config — entrance/exit toggles + default shapes, and any
  // organizer-defined custom door types (Fire Exit, Loading Bay, …).
  // Kept optional/loose so the venue config stays forward-compatible.
  @IsBoolean() @IsOptional() hasEntrance?: boolean;
  @IsBoolean() @IsOptional() hasExit?: boolean;
  @IsString() @IsOptional() entranceShape?: string;
  @IsString() @IsOptional() exitShape?: string;
  @IsArray() @IsOptional() customDoorTypes?: any[];
  // True once the organizer crops the venue — visitor views then show
  // exactly cropWidth×cropHeight instead of fitting to placed items. The
  // real width/height stay the reference venue size (never overwritten).
  @IsBoolean() @IsOptional() cropped?: boolean;
  @IsNumber() @IsOptional() cropWidth?: number;
  @IsNumber() @IsOptional() cropHeight?: number;
  // Public visibility — false hides this venue from the eventfront + vendor
  // selection tabs. Defaults to true when unset.
  @IsBoolean() @IsOptional() published?: boolean;
}

export class SpeakerSlotTemplateDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsString() @IsOptional() startTime?: string;
  @IsString() @IsOptional() endTime?: string;
  @IsBoolean() @IsOptional() isMainStage?: boolean;
  @IsNumber() @IsOptional() width?: number;
  @IsNumber() @IsOptional() height?: number;
  @IsNumber() @Min(0) @IsOptional() slotPrice?: number;
  @IsNumber() @Min(1) @IsOptional() maxSpeakers?: number;
  @IsNumber() @Min(0) @IsOptional() maxVisitors?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() assignedSpeakerId?: string;
  @IsString() @IsOptional() assignedSpeakerName?: string;
  @IsBoolean() @IsOptional() openForApplications?: boolean;
}

export class PositionedSpeakerZoneDto {
  @IsString() positionId: string;
  @IsString() templateId: string;
  @IsString() name: string;
  @IsString() @IsOptional() startTime?: string;
  @IsString() @IsOptional() endTime?: string;
  @IsBoolean() @IsOptional() isMainStage?: boolean;
  @IsNumber() width: number;
  @IsNumber() height: number;
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() @IsOptional() rotation?: number;
  @IsBoolean() @IsOptional() isPlaced?: boolean;
  @IsString() venueConfigId: string;
  @IsString() @IsOptional() assignedSpeakerId?: string;
  @IsString() @IsOptional() assignedSpeakerName?: string;
}

export class VisitorFeatureAccessDto {
  @IsBoolean() @IsOptional() food?: boolean;
  @IsBoolean() @IsOptional() parking?: boolean;
  @IsBoolean() @IsOptional() wifi?: boolean;
  @IsBoolean() @IsOptional() photography?: boolean;
  @IsBoolean() @IsOptional() security?: boolean;
  @IsBoolean() @IsOptional() accessibility?: boolean;
}

export class VisitorTypeDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsNumber() @Min(0) price: number;
  @IsNumber() @Min(1) @IsOptional() maxCount?: number;
  @IsString() @IsOptional() description?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => VisitorFeatureAccessDto)
  featureAccess?: VisitorFeatureAccessDto;

  @IsBoolean() @IsOptional() isActive?: boolean;
}

export class SpeakerSlotDto {
  @IsString()
  topic: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class SpeakerSocialLinksDto {
  @IsString()
  @IsOptional()
  linkedin?: string;

  @IsString()
  @IsOptional()
  twitter?: string;

  @IsString()
  @IsOptional()
  website?: string;
}

export class SpeakerDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  organization?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => SpeakerSocialLinksDto)
  socialLinks?: SpeakerSocialLinksDto;

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => SpeakerSlotDto)
  slots?: SpeakerSlotDto[];

  @IsBoolean()
  @IsOptional()
  isKeynote?: boolean;

  @IsNumber()
  @IsOptional()
  order?: number;
}

// Round table templates
export class RoundTableTemplateDto {
  @IsString() id: string;
  @IsString() name: string;
  @IsNumber() @Min(0) numberOfChairs: number;
  @IsString() sellingMode: string; // "table" | "chair"
  @IsNumber() @Min(0) @IsOptional() tablePrice?: number;
  @IsNumber() @Min(0) @IsOptional() chairPrice?: number;
  @IsNumber() @Min(0) @IsOptional() bookingPrice?: number;
  @IsNumber() @Min(0) @IsOptional() depositPrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberTablePrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberChairPrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberBookingPrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberDepositPrice?: number;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() color?: string;
  @IsNumber() @IsOptional() tableDiameter?: number;
  @IsBoolean() @IsOptional() forSale?: boolean;
}

// Positioned round tables on venue canvas
export class PositionedRoundTableDto {
  @IsString() positionId: string;
  @IsString() templateId: string;
  @IsString() name: string;
  @IsNumber() @Min(0) numberOfChairs: number;
  @IsString() sellingMode: string;
  @IsNumber() @Min(0) @IsOptional() tablePrice?: number;
  @IsNumber() @Min(0) @IsOptional() chairPrice?: number;
  @IsNumber() @Min(0) @IsOptional() bookingPrice?: number;
  @IsNumber() @Min(0) @IsOptional() depositPrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberTablePrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberChairPrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberBookingPrice?: number;
  @IsNumber() @Min(0) @IsOptional() memberDepositPrice?: number;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() color?: string;
  @IsNumber() @IsOptional() tableDiameter?: number;
  @IsBoolean() @IsOptional() forSale?: boolean;
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() @IsOptional() rotation?: number;
  @IsBoolean() @IsOptional() isPlaced?: boolean;
  @IsString() venueConfigId: string;
  @IsArray() @IsOptional() bookedChairs?: number[];
  @IsBoolean() @IsOptional() isFullyBooked?: boolean;
}

export class VolunteerDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

// A single ceremony within a Personal/Marriage event.
export class FunctionDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() time?: string;
  @IsString() @IsOptional() endTime?: string;
  @IsString() @IsOptional() venueName?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() dressCode?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() accommodation?: string;
  @IsBoolean() @IsOptional() isLive?: boolean;
  @IsString() @IsOptional() announcedAt?: string;
}

// Eventfront "Site Settings" — design controls for the public wedding page.
// Mirrors the frontend MarriageTheme (frontend/src/lib/marriageThemes.ts).
export class MarriageThemeDto {
  @IsString() @IsOptional() preset?: string;
  @IsString() @IsOptional() primaryColor?: string;
  @IsString() @IsOptional() accentColor?: string;
  @IsString() @IsOptional() bgColor?: string;
  @IsString() @IsOptional() textColor?: string;
  @IsString() @IsOptional() headingFont?: string;
  @IsNumber() @IsOptional() heroOverlay?: number;
  @IsString() @IsOptional() cornerStyle?: string;
  // Expanded design controls.
  @IsString() @IsOptional() heroHeight?: string;
  @IsString() @IsOptional() heroLayout?: string;
  @IsString() @IsOptional() heroTagline?: string;
  @IsBoolean() @IsOptional() showMonogram?: boolean;
  @IsString() @IsOptional() monogramStyle?: string;
  @IsString() @IsOptional() topMotif?: string;
  @IsString() @IsOptional() floralAccents?: string;
  @IsString() @IsOptional() headingStyle?: string;
  @IsString() @IsOptional() backgroundPattern?: string;
  @IsString() @IsOptional() fontScale?: string;
  @IsString() @IsOptional() galleryLayout?: string;
  @IsString() @IsOptional() storyLayout?: string;
  @IsBoolean() @IsOptional() animations?: boolean;
  // Per-section visibility map ({ countdown, welcome, story, ... }).
  @IsObject() @IsOptional() sections?: Record<string, boolean>;
}

// One moment in the "Our Story" image timeline. `content` is Quill HTML;
// `image` is an already-resolved /uploads URL (or empty when the moment has no
// photo). `hasNewImage` is a transient flag the controller uses to stitch in a
// freshly-uploaded file — it is not persisted.
export class StoryMomentDto {
  @IsString() @IsOptional() id?: string;
  @IsString() @IsOptional() title?: string;
  @IsString() @IsOptional() date?: string;
  @IsString() @IsOptional() content?: string;
  @IsString() @IsOptional() image?: string;
  @IsBoolean() @IsOptional() hasNewImage?: boolean;
}

// Couple + story details specific to a Marriage event.
export class MarriageDetailsDto {
  @IsString() @IsOptional() partner1Name?: string;
  @IsString() @IsOptional() partner2Name?: string;
  @IsString() @IsOptional() hostNames?: string;
  @IsString() @IsOptional() contactName?: string;
  @IsString() @IsOptional() contactPhone?: string;
  @IsString() @IsOptional() contactEmail?: string;
  @IsString() @IsOptional() ourStory?: string;
  @IsString() @IsOptional() howWeMet?: string;
  // "Our Story" image timeline — unlimited moments (title + date + Quill HTML +
  // optional image). Replaces the single ourStory string.
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StoryMomentDto)
  storyTimeline?: StoryMomentDto[];
  // Lodging suggestions (hotels, room blocks, etc.) shown to guests and
  // included in the RSVP confirmation email.
  @IsString() @IsOptional() accommodations?: string;
  // Any other logistics for guests — travel, gifts, parking, etc.
  @IsString() @IsOptional() additionalInfo?: string;
  // "Function has started" announcement-bar customization.
  @IsString() @IsOptional() adBarBgColor?: string;
  @IsString() @IsOptional() adBarTextColor?: string;
  @IsString() @IsOptional() adBarMessage?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MarriageThemeDto)
  theme?: MarriageThemeDto;
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  // "commercial" | "personal" — top-level grouping from the create pre-step.
  @IsString()
  @IsOptional()
  eventType?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @IsDateString()
  startDate: string;

  @IsString()
  @IsOptional()
  time?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsString()
  organizerId: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  ticketPrice?: string;

  @IsNumber()
  @IsOptional()
  totalTickets?: number;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsString()
  @IsOptional()
  inviteLink?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ValidateNested()
  @IsOptional()
  @Type(() => FeaturesDto)
  features?: FeaturesDto;

  @IsString()
  @IsOptional()
  ageRestriction?: string;

  @IsString()
  @IsOptional()
  dresscode?: string;

  @IsString()
  @IsOptional()
  specialInstructions?: string;

  @IsString()
  @IsOptional()
  refundPolicy?: string;

  @IsString()
  @IsOptional()
  termsAndConditions?: string;

  // Free-form custom sections from the Basic Info tab. Loose array
  // validation since the shape (id + heading + content) is small and
  // stable.
  @IsArray()
  @IsOptional()
  customSections?: { id: string; heading: string; content: string }[];

  // Per-section eventfront visibility map (keys: ageDress,
  // specialInstructions, refundPolicy, termsAndConditions + custom section
  // ids). Missing key = visible.
  @IsObject()
  @IsOptional()
  sectionVisibility?: Record<string, boolean>;

  @IsString()
  @IsOptional()
  setupTime?: string;

  @IsString()
  @IsOptional()
  breakdownTime?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => SocialMediaDto)
  socialMedia?: SocialMediaDto;

  @IsString()
  @IsOptional()
  image?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  gallery?: string[];

  // Event sponsor logo URLs — shown as a moving carousel on the eventfront.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sponsors?: string[];

  // Max total spaces a single vendor may request/book. Default 1.
  @IsNumber()
  @IsOptional()
  maxSpacesPerVendor?: number;

  // Instagram reel URLs — capped client-side at 10; surfaced as a
  // reel carousel on the eventfront. Loose string validation here so
  // organizers can paste any Instagram link format.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  reelLinks?: string[];

  // Announcement / Ad Bar — loose object validation since it's a
  // small, stable shape. Carries the marquee message + colors that
  // the eventfront's <AnnouncementBar/> renders at the top of the
  // page.
  @IsOptional()
  adBar?: {
    visible?: boolean;
    message?: string;
    bgColor?: string;
    textColor?: string;
  };

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => TableTemplateDto)
  tableTemplates?: TableTemplateDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => termsAndConditionsforStalls)
  termsAndConditionsforStalls?: termsAndConditionsforStalls[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => PositionedTableDto)
  venueTables?: PositionedTableDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => AddOnItemDto)
  addOnItems?: AddOnItemDto[];

  // CHANGED: now array to match schema
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => VenueConfigDto)
  venueConfig?: VenueConfigDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => SpeakerSlotTemplateDto)
  speakerSlotTemplates?: SpeakerSlotTemplateDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => PositionedSpeakerZoneDto)
  venueSpeakerZones?: PositionedSpeakerZoneDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => VisitorTypeDto)
  visitorTypes?: VisitorTypeDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => SpeakerDto)
  speakers?: SpeakerDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => RoundTableTemplateDto)
  roundTableTemplates?: RoundTableTemplateDto[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => PositionedRoundTableDto)
  venueRoundTables?: PositionedRoundTableDto[];

  // Placed entrance / exit doors. Kept as a loose array — the door
  // shape is small and stable enough that we can skip a typed
  // sub-DTO and still get the strict validation pipe to accept it.
  @IsArray()
  @IsOptional()
  venueDoors?: any[];

  // CAD annotations (lines / text / rects / dimensions). Loose array for
  // the same reason as venueDoors.
  @IsArray()
  @IsOptional()
  venueAnnotations?: any[];

  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => VolunteerDto)
  volunteers?: VolunteerDto[];

  // Marriage/Personal ceremonies + couple details.
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => FunctionDto)
  functions?: FunctionDto[];

  @ValidateNested()
  @IsOptional()
  @Type(() => MarriageDetailsDto)
  marriage?: MarriageDetailsDto;

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  // Public Eventfront chatbot settings — loose object validation (small,
  // stable shape) mirroring `adBar`. `enabled` shows/hides the widget on the
  // public event page; `name` is its display name (falls back to
  // "Event Assistant").
  @IsOptional()
  @IsObject()
  chatbot?: {
    enabled?: boolean;
    name?: string;
    accentColor?: string;
  };
}
