import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from "class-validator";

export class CreateCouponDto {
  @IsOptional()
  @IsString()
  shopkeeperId?: string;

  @IsOptional()
  @IsString()
  organizerId?: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(["PERCENTAGE", "FLAT"])
  discountType: "PERCENTAGE" | "FLAT";

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  discountPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  flatDiscountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsage?: number;

  @IsDateString()
  @IsOptional()
  expiryDate?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  eventId: string;

  @IsEnum(["SHOPKEEPER", "ORGANIZER", "GLOBAL"])
  appliesTo: "SHOPKEEPER" | "ORGANIZER" | "GLOBAL";
}
