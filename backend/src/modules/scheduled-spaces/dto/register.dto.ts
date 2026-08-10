import {
  IsArray,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { Types } from "mongoose";

// Phase 1 — a visitor registers interest in booking a Scheduled Space.
// Deliberately generic (no vendor/business fields) — the actual field set
// shown to the visitor is driven by the "scheduledSpace" registration-form
// category, but the request record itself only needs identity + contact.
export class RegisterScheduledSpaceDto {
  @IsMongoId()
  eventId: Types.ObjectId;

  @IsMongoId()
  organizerId: Types.ObjectId;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  facilityTypeRequested?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  organization?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companions?: string[];

  // Operator referral code — optional. Unlocks that operator's Scheduled
  // Spaces in the slot picker; spaces with no operator assigned stay
  // visible regardless.
  @IsOptional()
  @IsString()
  referralCode?: string;
}
