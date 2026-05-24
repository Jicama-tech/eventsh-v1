import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class RequestOtpDto {
  @IsEmail()
  email: string;
}

export class SubmitAppFeedbackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEnum(["organizer", "vendor", "visitor", "speaker", "general"])
  @IsOptional()
  role?: "organizer" | "vendor" | "visitor" | "speaker" | "general";

  @IsEmail()
  email: string;

  @IsString()
  otp: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  comment: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  city?: string;
}

export class UpdateAppFeedbackDto {
  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsInt()
  @IsOptional()
  featuredOrder?: number;

  @IsBoolean()
  @IsOptional()
  hidden?: boolean;

  // Super admin can polish the public comment without touching the original.
  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  name?: string;

  // Lets super admin move a support ticket through its lifecycle.
  @IsEnum(["open", "in_progress", "resolved"])
  @IsOptional()
  status?: "open" | "in_progress" | "resolved";
}

// Submitted by an authenticated organizer from the dashboard Support tab.
// No OTP — JWT covers identity. Attachments are uploaded via multipart, so
// only the text fields are validated here.
export class SubmitSupportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject: string;

  @IsEnum(["bug", "feature_request", "general", "billing", "other"])
  category: "bug" | "feature_request" | "general" | "billing" | "other";

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description: string;
}
