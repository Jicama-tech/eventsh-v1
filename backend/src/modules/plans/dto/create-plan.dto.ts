import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsBoolean,
  IsOptional,
  IsObject,
  Min,
} from "class-validator";
import { ModuleType } from "../entities/plan.entity";

export class CreatePlanDto {
  @IsString()
  planName: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsArray()
  @IsString({ each: true })
  features: string[];

  @IsOptional()
  @IsEnum(ModuleType)
  moduleType?: ModuleType = ModuleType.ORGANIZER;

  @IsNumber()
  @Min(1)
  validityInDays: number;

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
}
