import {
  IsString,
  IsOptional,
  IsMongoId,
  IsEmail,
  IsNotEmpty,
  IsNumber,
} from "class-validator";
import { Types } from "mongoose";

/**
 * DTO for creating initial stall request (Phase 1)
 * This is used when a vendor first requests a stall
 * Only basic information is needed at this stage
 */
export class CreateStallDto {
  @IsMongoId()
  eventId: Types.ObjectId;

  @IsMongoId()
  organizerId: Types.ObjectId;

  // Vendor Info - if exists, use ID; if not, create new
  @IsOptional()
  @IsMongoId()
  shopkeeperId?: Types.ObjectId;

  // When true, always create a NEW vendor profile even if a vendor with the
  // same email/WhatsApp already exists. Used by the eventfront "Register a new
  // request" flow so one authenticated email can own multiple vendor profiles
  // (linked accounts). Coerced in the service (multipart sends it as a string).
  @IsOptional()
  forceNewVendor?: boolean | string;

  // Vendor details (if creating new vendor)
  @IsOptional()
  @IsString()
  shopkeeperName?: string;

  @IsOptional()
  @IsEmail()
  shopkeeperEmail?: string;

  // Second exhibitor email (the "Business Email" on the stall form). Persisted
  // alongside `email` so stall notifications reach BOTH addresses.
  @IsOptional()
  @IsEmail()
  shopkeeperBusinessEmail?: string;

  @IsOptional()
  @IsString()
  shopkeeperWhatsAppNumber?: string;

  @IsOptional()
  @IsString()
  shopkeeperCountryCode?: string;

  @IsOptional()
  @IsString()
  shopkeeperPhoneNumber?: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  businessCategory?: string;

  @IsOptional()
  @IsString()
  preferredTemplateId?: string;

  @IsOptional()
  @IsString()
  preferredTemplateName?: string;

  // JSON-encoded string[] (multipart form sends arrays as a string). Lets the
  // vendor pick a COMBINATION of preferred space types.
  @IsOptional()
  @IsString()
  preferredTemplateIds?: string;

  @IsOptional()
  @IsString()
  preferredTemplateNames?: string;

  // JSON array of requested quantities, parallel to preferredTemplateIds.
  @IsOptional()
  @IsString()
  preferredTemplateQuantities?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessCity?: string;

  @IsOptional()
  @IsString()
  businessState?: string;

  @IsOptional()
  @IsString()
  businessPincode?: string;

  // Additional Info
  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  noOfOperators: string;

  @IsNotEmpty()
  @IsString()
  brandName: string;

  @IsNotEmpty()
  @IsString()
  nameOfApplicant: string;

  @IsOptional()
  @IsString()
  registrationImage: string;

  @IsOptional()
  @IsString()
  registrationNumber: string;

  @IsOptional()
  @IsString()
  residency: string;

  @IsOptional()
  @IsString()
  refundPaymentDescription: string;

  @IsOptional()
  @IsString()
  businessOwnerNationality: string;

  @IsOptional()
  @IsString()
  companyLogo?: string;

  @IsOptional()
  @IsString()
  faceBookLink?: string;

  @IsOptional()
  @IsString()
  instagramLink?: string;

  @IsOptional()
  @IsString()
  productDescription?: string;

  @IsOptional()
  @IsString()
  productImage?: string[];

  // GST verification result (India). Cached on the vendor so returning
  // exhibitors aren't re-verified. `gstDetails` is a JSON string (multipart).
  @IsOptional()
  isGSTVerified?: boolean | string;

  @IsOptional()
  @IsString()
  gstDetails?: string;

  // UEN verification result (Singapore). Cached on the vendor; uenDetails is a
  // JSON string (multipart).
  @IsOptional()
  isUENVerified?: boolean | string;

  @IsOptional()
  @IsString()
  uenDetails?: string;
}
