import { IsNotEmpty, IsString } from "class-validator";

export class RegisterInstanceDto {
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  domain: string;
}
