import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

// Issued by the public storefront after payment. The organizer's id is
// derived server-side from the storefront slug, so the body just carries
// the exhibitor data + which plan and what was paid.
export class RegisterMembershipPurchaseDto {
  @IsString()
  planId: string;

  @IsString()
  exhibitorName: string;

  @IsEmail()
  exhibitorEmail: string;

  @IsString()
  exhibitorWhatsapp: string;

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  businessCategory?: string;

  @IsNumber()
  @Min(0)
  amountPaid: number;

  @IsString()
  paymentRef: string;

  @IsString()
  @IsIn(["razorpay", "stripe", "manual"])
  @IsOptional()
  paymentMethod?: string;
}

export class ConfirmMembershipDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class RejectMembershipDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class LookupMembershipExhibitorDto {
  @IsString()
  whatsapp: string;
}
