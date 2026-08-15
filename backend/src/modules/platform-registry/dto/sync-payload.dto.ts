import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class SyncUserRecordDto {
  @IsNotEmpty()
  @IsString()
  externalId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsDateString()
  createdAt?: string;
}

export class SyncStatsDto {
  @IsOptional()
  @IsNumber()
  organizerCount?: number;

  @IsOptional()
  @IsNumber()
  vendorCount?: number;

  @IsOptional()
  @IsNumber()
  attendeeCount?: number;

  @IsOptional()
  @IsNumber()
  operatorCount?: number;

  @IsOptional()
  @IsNumber()
  eventCount?: number;
}

export class SyncUsersDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncUserRecordDto)
  organizers?: SyncUserRecordDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncUserRecordDto)
  vendors?: SyncUserRecordDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncUserRecordDto)
  attendees?: SyncUserRecordDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncUserRecordDto)
  operators?: SyncUserRecordDto[];
}

// Batch payload a white-label instance's platform-sync.service.ts POSTs to
// POST /platform-registry/sync — guarded by InstanceLicenseGuard, not the
// normal JWT guard (server-to-server, not a logged-in admin).
export class SyncPayloadDto {
  @IsNotEmpty()
  @IsString()
  instanceId: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SyncStatsDto)
  stats?: SyncStatsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SyncUsersDto)
  users?: SyncUsersDto;
}
