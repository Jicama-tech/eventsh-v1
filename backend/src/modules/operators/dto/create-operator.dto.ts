import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateOperatorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  whatsAppNumber: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  shopkeeperId?: string;

  @IsString()
  @IsOptional()
  organizerId?: string;
}
