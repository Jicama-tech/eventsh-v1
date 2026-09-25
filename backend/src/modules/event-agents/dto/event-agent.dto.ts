import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/** A new agent for an event. The referral code is generated, never posted. */
export class CreateEventAgentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: "Enter the agent's name." })
  @MaxLength(80)
  name: string;

  // Stored as typed (with the country code); the same digits rule as every
  // other WhatsApp field. Optional so an agent can be email-only.
  @Transform(trim)
  @IsOptional()
  @ValidateIf((o) => !!o.whatsAppNumber)
  @IsString()
  @Matches(/^\+?[\d\s()-]{8,20}$/, {
    message: "Enter the WhatsApp number with its country code, e.g. +91 98765 43210.",
  })
  whatsAppNumber?: string;

  @Transform(trim)
  @IsOptional()
  @ValidateIf((o) => !!o.email)
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(120)
  email?: string;

  /** How many bookings the code may be credited for; 0 or omitted = no cap. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  maxUses?: number;
}

export class UpdateEventAgentDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @Transform(trim)
  @IsOptional()
  @ValidateIf((o) => !!o.whatsAppNumber)
  @IsString()
  @Matches(/^\+?[\d\s()-]{8,20}$/, {
    message: "Enter the WhatsApp number with its country code, e.g. +91 98765 43210.",
  })
  whatsAppNumber?: string;

  @Transform(trim)
  @IsOptional()
  @ValidateIf((o) => !!o.email)
  @IsEmail({}, { message: "Enter a valid email address." })
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  maxUses?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Which channels to send the agent's link on. Default: every one on file. */
export class ShareEventAgentDto {
  @IsOptional()
  @IsIn(["whatsapp", "email", "both"])
  channel?: "whatsapp" | "email" | "both";

  /** An optional personal line from the organizer, added above the link. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
