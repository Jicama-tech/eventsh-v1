import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
  IsObject,
} from "class-validator";

export class CreateRsvpDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  contactNumber?: string;

  // Total headcount including the guest themselves.
  @IsInt()
  @Min(0)
  @IsOptional()
  guestCount?: number;

  @IsString()
  @IsOptional()
  message?: string;

  @IsBoolean()
  @IsOptional()
  attending?: boolean;

  // "groom" | "bride" | "" — which side the guest is from.
  @IsString()
  @IsOptional()
  side?: string;

  // Ceremonies the guest will attend, as {id, name} snapshots.
  @IsArray()
  @IsOptional()
  functions?: { id: string; name: string }[];

  // Full roster of attending guests: [{ name, age, contactNumber }].
  @IsArray()
  @IsOptional()
  attendees?: { name: string; age?: number; contactNumber?: string }[];

  // Age-group counts for this party: { adults, seniors, children, infants }.
  // Legacy path — derived from `attendees` when that's provided.
  @IsObject()
  @IsOptional()
  ageGroups?: {
    adults?: number;
    seniors?: number;
    children?: number;
    infants?: number;
  };

  @IsString()
  @IsOptional()
  googleId?: string;
}
