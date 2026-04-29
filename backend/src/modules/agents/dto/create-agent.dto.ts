import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  whatsAppNumber: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  secondaryContact?: string;

  @IsNumber()
  @IsOptional()
  salesTarget?: number;

  @IsString()
  @IsOptional()
  referralCode?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
