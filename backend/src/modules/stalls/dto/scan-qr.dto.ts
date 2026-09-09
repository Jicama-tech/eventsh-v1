import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";

export type StallScanAction = "CHECK_IN" | "CHECK_OUT";

export class ScanQRDto {
  @IsNotEmpty()
  @IsString()
  qrCodeData: string;

  // The operator's explicit choice on the scanner's Check-In / Check-Out
  // screen. The global ValidationPipe runs with forbidNonWhitelisted, so this
  // MUST be declared here — the scanner has always posted it, and without the
  // property every exhibitor scan was rejected with
  // 400 "property action should not exist" before the handler ever ran.
  //
  // Optional so a client that posts only qrCodeData still works; those fall
  // back to deriving the action from the booking's current attendance state.
  @IsOptional()
  @IsIn(["CHECK_IN", "CHECK_OUT"])
  action?: StallScanAction;
}
