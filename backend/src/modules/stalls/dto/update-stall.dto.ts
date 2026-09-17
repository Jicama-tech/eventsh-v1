import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateStallDto } from "./create-stall.dto";
import { IsOptional, IsString, IsDateString } from "class-validator";

// Referral attribution is set once at creation, never through updates.
export class UpdateStallDto extends PartialType(
  OmitType(CreateStallDto, ["referralCode"] as const),
) {
  @IsOptional()
  @IsString()
  qrCodePath?: string;

  @IsOptional()
  @IsDateString()
  checkInTime?: Date;

  @IsOptional()
  @IsDateString()
  checkOutTime?: Date;
}
