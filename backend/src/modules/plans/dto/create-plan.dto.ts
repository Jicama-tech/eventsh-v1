import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  IsObject,
  IsDateString,
  Min,
} from "class-validator";
import { ModuleType, ValidityType } from "../entities/plan.entity";

export class CreatePlanDto {
  @IsString()
  planName: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceINR?: number;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsOptional()
  @IsEnum(ModuleType)
  moduleType?: ModuleType = ModuleType.ORGANIZER;

  // "days" (rolling N-day window) or "date" (valid up to a fixed date).
  @IsOptional()
  @IsEnum(ValidityType)
  validityType?: ValidityType;

  // Required only when validityType is "days".
  @IsOptional()
  @IsNumber()
  @Min(1)
  validityInDays?: number;

  // Required only when validityType is "date" (ISO date string).
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  modules?: any;

  // Restrict visibility to a subset of organizers (by id). Empty array
  // or omitted = visible to everyone (default).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleToOrganizers?: string[];
}
