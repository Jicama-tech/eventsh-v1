import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateOperatorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Optional — operators sign in with Google, so email is the identity.
  @IsString()
  @IsOptional()
  whatsAppNumber?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  shopkeeperId?: string;

  @IsString()
  @IsOptional()
  organizerId?: string;

  // Empty = full access; non-empty = restricted to listed tab IDs
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  accessTabs?: string[];
}
