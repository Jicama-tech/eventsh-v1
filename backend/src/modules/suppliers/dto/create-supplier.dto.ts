import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Organizer-side create of a Supplier identity (the CRM "Add Supplier" form,
 * mirroring CreateShopkeeperDto for exhibitors). The supplier persists across
 * events; per-event quotations are separate (SupplierRequest).
 */
export class CreateSupplierDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  // "Service provided" — free-text category (catering, décor, sound, …).
  @IsOptional()
  @IsString()
  serviceCategory?: string;

  // Personal / login email (the Gmail the supplier signs in with).
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  businessEmail?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  whatsAppNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
