import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * A business applying to sponsor an event. Sent as multipart/form-data (the
 * logo rides along), so every field arrives as a string and numbers are
 * coerced in the service.
 */
export class CreateSponsorRequestDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  // Which tier of `Event.sponsorTypes` they're applying for. The service
  // resolves the name + price from the event so the client can't set its
  // own price.
  @IsString()
  @IsNotEmpty()
  sponsorTypeId: string;

  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsEmail()
  email: string;

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
  message?: string;
}
