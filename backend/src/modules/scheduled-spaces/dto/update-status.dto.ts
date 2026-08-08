import { IsEnum, IsOptional, IsString } from "class-validator";

// Used by the organizer to approve/reject a registration (Pending ->
// Confirmed/Rejected), and later to cancel a completed booking.
export class UpdateScheduledSpaceStatusDto {
  @IsEnum(["Pending", "Confirmed", "Rejected", "Processing", "Completed", "Cancelled"])
  status:
    | "Pending"
    | "Confirmed"
    | "Rejected"
    | "Processing"
    | "Completed"
    | "Cancelled";

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
