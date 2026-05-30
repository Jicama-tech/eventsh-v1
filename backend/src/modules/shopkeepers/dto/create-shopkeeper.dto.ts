import {
  IsBoolean,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateShopkeeperDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @IsOptional()
  @IsString()
  whatsAppNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  shopName?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessCategory?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  brandName?: string;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsBoolean()
  rejected?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDocVerification?: boolean;

  // Manual member flag — organizer can mark an exhibitor as a member
  // straight from the Add Exhibitor form (e.g. for legacy or comp'd
  // memberships that didn't go through the storefront purchase flow).
  // The membership lifecycle (confirm / reject / expire) still drives
  // this field automatically when an ExhibitorMembership exists.
  @IsOptional()
  @IsBoolean()
  isMember?: boolean;

  // ISO date string. Optional — organizers tracking memberships
  // outside the storefront purchase flow can set this manually so
  // the CRM badge shows the right expiry. When an ExhibitorMembership
  // is later confirmed/expired for the same exhibitor, the
  // memberships service overwrites this field in sync with the
  // canonical record.
  @IsOptional()
  @IsString()
  membershipEndDate?: string;
}
