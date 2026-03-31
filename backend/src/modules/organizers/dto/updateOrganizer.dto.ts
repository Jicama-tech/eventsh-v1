import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDate,
  IsEnum,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ReceiptType } from "../schemas/organizer.schema"; // Adjust path as needed

export class UpdateOrganizerDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsString()
  @IsOptional()
  organizationName?: string; // Mapped from shopName

  @IsEmail()
  @IsOptional()
  email?: string;

  // Keep password optional for updates; only validate strength if provided
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEmail()
  @IsOptional()
  businessEmail?: string;

  @IsString()
  @IsOptional()
  whatsAppNumber?: string; // Mapped from whatsappNumber

  @IsString()
  @IsOptional()
  businessCategory?: string;

  @IsNumber()
  @IsOptional()
  followers?: number;

  @IsString()
  @IsOptional()
  paymentURL?: string;

  @IsString()
  @IsOptional()
  paymentQrUrl?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  operationsPausedFromDate?: Date; // Mapped from shopClosedFromDate

  @IsString()
  @IsOptional()
  country?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  operationsPausedToDate?: Date; // Mapped from shopClosedToDate

  @IsString()
  @IsOptional()
  GSTNumber?: string;

  @IsString()
  @IsOptional()
  UENNumber?: string;

  @IsString()
  @IsOptional()
  taxPercentage?: number;

  @IsString()
  @IsOptional()
  discountPercentage?: number;

  @IsString()
  @IsOptional()
  whatsAppQRNumber?: string;

  @IsOptional()
  @IsString()
  instagramHandle?: string;

  // ✅ NEW: Document Verification Status
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  whatsAppQR?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  instagramQR?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  dynamicQR?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  hasDocVerification?: boolean;

  @IsEnum(ReceiptType, {
    message: "receiptType must be either '58MM' or 'A4'",
  })
  @IsOptional()
  receiptType?: ReceiptType;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @IsString()
  @IsOptional()
  bio?: string;
}
