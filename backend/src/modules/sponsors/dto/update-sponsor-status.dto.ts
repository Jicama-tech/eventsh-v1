import { IsEnum, IsOptional, IsString } from "class-validator";

/** Organizer decision on a sponsorship application. */
export class UpdateSponsorStatusDto {
  @IsEnum(["Approved", "Rejected", "Cancelled"])
  status: "Approved" | "Rejected" | "Cancelled";

  // Shown on the timeline when the organizer declines.
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
