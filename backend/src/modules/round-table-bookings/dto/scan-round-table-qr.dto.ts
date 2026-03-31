import { IsString } from "class-validator";

export class ScanRoundTableQRDto {
  @IsString()
  qrCodeData: string;
}
