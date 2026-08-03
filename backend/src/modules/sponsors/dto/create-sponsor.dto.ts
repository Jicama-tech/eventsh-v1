import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

/** Organizer adding a sponsor to their own directory (CRM), by hand. */
export class CreateSponsorDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Multipart sends booleans as the strings "true"/"false"; normalise before
  // validation so the flag can ride along with a logo upload.
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  showOnBar?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
