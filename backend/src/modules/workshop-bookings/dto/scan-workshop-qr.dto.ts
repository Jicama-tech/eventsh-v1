import { IsString } from "class-validator";

export class ScanWorkshopQRDto {
  @IsString()
  qrCodeData: string;
}
