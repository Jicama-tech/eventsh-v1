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
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ModuleType, ValidityType } from "../entities/plan.entity";

// One purchasable add-on row on the plan. `key` must be a Plan.modules key;
// `limitDelta` present = limit pack, absent = module toggle. Prices follow
// the plan's dual-currency convention (price = USD/SGD, priceINR for India).
export class PlanAddOnDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceINR?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limitDelta?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

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

  // Purchasable feature add-ons (see PlanAddOnDto).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanAddOnDto)
  addOns?: PlanAddOnDto[];

  // Restrict visibility to a subset of organizers (by id). Empty array
  // or omitted = visible to everyone (default).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleToOrganizers?: string[];
}
