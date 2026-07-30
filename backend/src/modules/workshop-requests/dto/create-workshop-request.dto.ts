import {
  IsString,
  IsOptional,
  IsNumber,
  IsMongoId,
  IsIn,
  IsBoolean,
  Min,
} from "class-validator";

export class CreateWorkshopRequestDto {
  @IsMongoId()
  eventId: string;

  @IsMongoId()
  organizerId: string;

  @IsString()
  hostName: string;

  @IsString()
  @IsOptional()
  hostEmail?: string;

  @IsString()
  @IsOptional()
  hostPhone?: string;

  @IsString()
  @IsOptional()
  hostBio?: string;

  @IsString()
  @IsOptional()
  hostImage?: string;

  @IsString()
  workshopName: string;

  @IsString()
  @IsOptional()
  workshopDescription?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedPrice?: number;

  @IsString()
  @IsOptional()
  proposedStartTime?: string;

  @IsString()
  @IsOptional()
  proposedEndTime?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSeats?: number;
}

export class UpdateWorkshopRequestStatusDto {
  @IsIn(["Confirmed", "Rejected", "Cancelled"])
  status: "Confirmed" | "Rejected" | "Cancelled";

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @IsString()
  @IsOptional()
  changedBy?: string;
}

export class UpdateWorkshopHostingFeeDto {
  @IsBoolean()
  isCharged: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  fee?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateWorkshopProposalDto {
  @IsString()
  @IsOptional()
  workshopName?: string;

  @IsString()
  @IsOptional()
  workshopDescription?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  finalPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSeats?: number;

  @IsString()
  @IsOptional()
  proposedStartTime?: string;

  @IsString()
  @IsOptional()
  proposedEndTime?: string;
}
