import { IsIn, IsNotEmpty } from "class-validator";
import { StallScanAction } from "./scan-qr.dto";

// Manual check-in / check-out, for a vendor who turned up without their QR.
// `action` is required here — unlike the scan, there is no stored payload to
// infer intent from, so the volunteer must say which way they mean.
export class ManualAttendanceDto {
  @IsNotEmpty()
  @IsIn(["CHECK_IN", "CHECK_OUT"])
  action: StallScanAction;
}
