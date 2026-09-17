import { IsString, IsNumber, IsEmail, IsMongoId, IsIn, IsOptional, Min } from "class-validator";

export class CreateWorkshopBookingDto {
  @IsMongoId()
  eventId: string;

  @IsMongoId()
  organizerId: string;

  @IsIn(["session", "package"])
  bookingType: "session" | "package";

  // Exactly one of sessionId / packageId is expected, matching bookingType.
  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  packageId?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  visitorName: string;

  @IsEmail()
  visitorEmail: string;

  @IsString()
  visitorPhone: string;

  // Operator referral code from a shared event link (?ref=). Only saved when
  // it resolves to an enabled operator of this event's organizer.
  @IsString()
  @IsOptional()
  referralCode?: string;
}
