import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ConfirmScheduledSpacePaymentDto {
  @IsNotEmpty()
  @IsString()
  requestId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  changedBy?: string;
}
