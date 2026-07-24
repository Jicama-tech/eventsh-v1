import { IsEnum, IsOptional, IsString } from "class-validator";

/**
 * Organizer decision on a supplier's quotation.
 */
export class UpdateSupplierStatusDto {
  @IsEnum(["Approved", "Rejected", "Completed", "Cancelled"])
  status: "Approved" | "Rejected" | "Completed" | "Cancelled";

  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
