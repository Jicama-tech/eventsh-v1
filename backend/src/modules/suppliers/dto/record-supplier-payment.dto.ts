import { IsOptional, IsString } from "class-validator";

/**
 * Organizer logs a payment made to the supplier (manual bank transfer). Sent
 * as multipart/form-data with an optional proof screenshot, so numeric fields
 * arrive as strings and are coerced in the service.
 */
export class RecordSupplierPaymentDto {
  @IsOptional()
  amountPaid?: number | string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  // ISO date string; defaults to now in the service if omitted.
  @IsOptional()
  @IsString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
