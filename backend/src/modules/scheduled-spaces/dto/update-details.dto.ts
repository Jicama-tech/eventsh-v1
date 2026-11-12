import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

// Visitor edits their registration details after submitting them (the "Your
// details" step of the booking stepper), while still on the slot picker.
// Email is deliberately absent — it's the Google-verified identity — and so
// is the referral code, which only attributes the request at registration.
export class UpdateScheduledSpaceDetailsDto {
  @IsNotEmpty()
  @IsString()
  name: string;

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

  @IsOptional()
  @IsObject()
  customAnswers?: Record<string, string>;
}
