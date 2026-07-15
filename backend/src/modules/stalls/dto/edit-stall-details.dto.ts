import { IsOptional, IsString } from "class-validator";

/**
 * Organizer/operator edit of a stall's FULL form (contact + business profile +
 * applicant/registration details). Contact/business fields persist to the
 * vendor record; applicant/registration fields persist to both the stall and
 * the vendor. All fields optional — only what's sent is updated.
 */
export class EditStallDetailsDto {
  // ── Contact / vendor profile ──
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() businessEmail?: string;
  @IsOptional() @IsString() whatsAppNumber?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() businessCategory?: string;
  @IsOptional() @IsString() businessDescription?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() faceBookLink?: string;
  @IsOptional() @IsString() instagramLink?: string;

  // ── Shared: applicant / registration (stall + vendor) ──
  @IsOptional() @IsString() brandName?: string;
  @IsOptional() @IsString() nameOfApplicant?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() residency?: string;
  @IsOptional() @IsString() businessOwnerNationality?: string;
  @IsOptional() @IsString() refundPaymentDescription?: string;
  @IsOptional() @IsString() productDescription?: string;
  @IsOptional() @IsString() noOfOperators?: string;

  @IsOptional() @IsString() changedBy?: string;
}
