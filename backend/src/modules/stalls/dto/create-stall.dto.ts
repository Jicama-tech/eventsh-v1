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

  // Vendor details (if creating new vendor)
  @IsOptional()
  @IsString()
  shopkeeperName?: string;

  @IsOptional()
  @IsEmail()
  shopkeeperEmail?: string;

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
}
