import {
  IsArray,
  IsString,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SelectedAddOnDto } from "./tableSelect.dto";

/**
 * Vendor "Edit Request" — proposes a new operator count and the FULL desired
 * add-on list (existing + added). The server validates it is add-only (no
 * removals / reductions vs the current booking), re-prices against the event's
 * add-on catalogue, and computes the extra amount owed.
 */
export class AmendStallDto {
  // New operator count (free — only resizes the coupon / QR).
  @IsString()
  noOfOperators: string;

  // Full add-on list the vendor wants after the edit.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedAddOnDto)
  selectedAddOns?: SelectedAddOnDto[];
}

/** Vendor records the top-up transaction for an amendment's price difference. */
export class AmendPaymentDto {
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  // Screenshot travels as a multipart file; kept optional here for the JSON path.
  @IsOptional()
  @IsString()
  transactionScreenshot?: string;
}

/** Organizer confirms a paid/no-cost amendment → apply + re-issue QR. */
export class ConfirmAmendmentDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}

/** Vendor requests to cancel/delete their booking, with a reason. */
export class RequestCancellationDto {
  @IsString()
  reason: string;
}

/**
 * Organizer decides on a cancellation request. On approve the space is freed,
 * the QR invalidated and the vendor emailed the organizerNote (refund details).
 */
export class CancellationDecisionDto {
  @IsBoolean()
  approve: boolean;

  @IsOptional()
  @IsString()
  organizerNote?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
