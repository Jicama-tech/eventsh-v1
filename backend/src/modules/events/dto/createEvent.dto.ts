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
  @IsNumber() @Min(2) numberOfChairs: number;
  @IsString() sellingMode: string; // "table" | "chair"
  @IsNumber() @Min(0) @IsOptional() tablePrice?: number;
  @IsNumber() @Min(0) @IsOptional() chairPrice?: number;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() color?: string;
  @IsNumber() @IsOptional() tableDiameter?: number;
}

// Positioned round tables on venue canvas
export class PositionedRoundTableDto {
  @IsString() positionId: string;
  @IsString() templateId: string;
  @IsString() name: string;
  @IsNumber() @Min(2) numberOfChairs: number;
  @IsString() sellingMode: string;
  @IsNumber() @Min(0) @IsOptional() tablePrice?: number;
  @IsNumber() @Min(0) @IsOptional() chairPrice?: number;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() color?: string;
  @IsNumber() @IsOptional() tableDiameter?: number;
  @IsNumber() x: number;
  @IsNumber() y: number;
  @IsNumber() @IsOptional() rotation?: number;
  @IsBoolean() @IsOptional() isPlaced?: boolean;
  @IsString() venueConfigId: string;
  @IsArray() @IsOptional() bookedChairs?: number[];
  @IsBoolean() @IsOptional() isFullyBooked?: boolean;
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  category?: string;

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

  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}
