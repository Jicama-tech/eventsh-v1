import { IsOptional, IsString } from "class-validator";

/**
 * Sponsor submits their transfer details after being approved. Multipart —
 * the payment screenshot rides along as `transactionScreenshot`.
 */
export class SubmitSponsorPaymentDto {
  @IsOptional()
  @IsString()
  transactionId?: string;

  // "qr" | "bank_transfer" — matches the stall booking convention.
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/** Organizer confirms (or rejects) the money actually landed. */
export class VerifySponsorPaymentDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
