import { IsString, MaxLength, MinLength } from "class-validator";

/** One message to one number — the "send a test" box in Settings › WhatsApp,
 * used to prove a freshly linked phone actually sends. */
export class SendWhatsappDto {
  // The same sentence the service uses for an unaddressable number, so the
  // card shows it instead of class-validator's English.
  @IsString()
  @MinLength(5, { message: "Include the country code, e.g. +91 98765 43210" })
  @MaxLength(32)
  phone: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message: string;
}
