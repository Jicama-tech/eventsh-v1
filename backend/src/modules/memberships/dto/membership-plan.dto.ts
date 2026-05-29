import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateMembershipPlanDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string; // server fills from organizer if omitted

  @IsInt()
  @Min(1)
  @Max(3650)
  durationDays: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perks?: string[];

  @IsString()
  @IsOptional()
  color?: string;

  @IsBoolean()
  @IsOptional()
  published?: boolean;
}

export class UpdateMembershipPlanDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @Min(0) @IsOptional() price?: number;
  @IsInt() @Min(1) @Max(3650) @IsOptional() durationDays?: number;
  @IsArray() @IsString({ each: true }) @IsOptional() perks?: string[];
  @IsString() @IsOptional() color?: string;
  @IsBoolean() @IsOptional() published?: boolean;
  @IsBoolean() @IsOptional() archived?: boolean;
}
