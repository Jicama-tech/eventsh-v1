import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
} from "class-validator";

export class CreateOrganizerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  organizationName: string; // Matches 'shopName' in Shopkeeper

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  whatsAppNumber: string; // CamelCase to match organizer.schema.ts

  @IsEmail()
  @IsNotEmpty()
  businessEmail: string;

  // @IsString()
  // @IsNotEmpty()
  // businessCategory: string;

  @IsString()
  @IsOptional()
  GSTNumber?: string;

  @IsString()
  @IsOptional()
  UENNumber?: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  role?: string;
}
