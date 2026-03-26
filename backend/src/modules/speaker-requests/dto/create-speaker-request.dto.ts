import {
  IsString,
  IsOptional,
  IsMongoId,
  IsEmail,
  IsBoolean,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { Types } from "mongoose";

export class SessionSlotDto {
  @IsString()
  topic: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  preferredStartTime?: string;

  @IsString()
  @IsOptional()
  preferredEndTime?: string;

  @IsNumber()
  @IsOptional()
  duration?: number;
}

export class CreateSpeakerRequestDto {
  @IsMongoId()
  eventId: string;

  @IsMongoId()
  organizerId: string;

  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  organization?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  expertise?: string;

  @IsOptional()
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  @Type(() => SessionSlotDto)
  sessions?: SessionSlotDto[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  previousSpeakingExperience?: string;

  @IsString()
  @IsOptional()
  equipmentNeeded?: string;

  @IsBoolean()
  @IsOptional()
  isKeynote?: boolean;

  @IsString()
  @IsOptional()
  source?: string;
}

export class UpdateSpeakerRequestStatusDto {
  @IsString()
  status: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  changedBy?: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}

export class UpdateSpeakerFeeDto {
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

export class ConfirmSessionTimesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmedSlotDto)
  sessions: ConfirmedSlotDto[];
}

export class ConfirmedSlotDto {
  @IsString()
  topic: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  confirmedStartTime: string;

  @IsString()
  confirmedEndTime: string;
}
