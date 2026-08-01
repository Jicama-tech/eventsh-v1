import { IsEnum, IsOptional, IsString } from "class-validator";

/**
 * Organizer decision on a supplier's quotation.
 */
export class UpdateSupplierStatusDto {
  @IsEnum(["Approved", "Rejected", "Negotiating", "Completed", "Cancelled"])
  status: "Approved" | "Rejected" | "Negotiating" | "Completed" | "Cancelled";

  // Reason shown on the timeline when the organizer rejects.
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  // Free-text note: the approval message, or the counter-offer when negotiating.
  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Price agreed at this step. Sent with a counter-offer or an approval so
   * the payable amount reflects what was actually settled on, not the
   * original quote.
   */
  @IsOptional()
  agreedAmount?: number | string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
