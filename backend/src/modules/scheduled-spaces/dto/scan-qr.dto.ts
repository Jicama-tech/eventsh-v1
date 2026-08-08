import { IsNotEmpty, IsString } from "class-validator";

export class ScanScheduledSpaceQRDto {
  @IsNotEmpty()
  @IsString()
  qrCodeData: string;
}
