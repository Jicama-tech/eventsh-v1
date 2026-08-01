import { IsEnum, IsOptional, IsString } from "class-validator";

/**
 * Supplier's reply during negotiation, from the public quotation timeline
 * (Google-verified email gates it). They can accept, counter, or decline —
 * mirroring the organizer's Approve / Negotiate / Reject.
 */
export class SupplierRespondDto {
  @IsEnum(["Approved", "Negotiating", "Rejected"])
  status: "Approved" | "Negotiating" | "Rejected";

  // Message: the counter-offer when negotiating, or the reason when rejecting.
  @IsOptional()
  @IsString()
  note?: string;

  /** The supplier's counter-price, when they're proposing a new figure. */
  @IsOptional()
  agreedAmount?: number | string;
}
