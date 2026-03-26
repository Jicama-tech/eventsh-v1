import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LocalDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
