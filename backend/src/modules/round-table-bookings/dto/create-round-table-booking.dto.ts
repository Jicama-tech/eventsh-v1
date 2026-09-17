import {
  IsString,
  IsArray,
  IsNumber,
  IsEmail,
  IsMongoId,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class SeatGuestDto {
  @IsNumber()
  chairIndex: number;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  whatsApp?: string;

  @IsString()
  @IsOptional()
  email?: string;
}

export class CreateRoundTableBookingDto {
  @IsMongoId()
  eventId: string;

  @IsMongoId()
  organizerId: string;

  @IsString()
  tablePositionId: string;

  // May be empty for a whole-table booking of a standing table (0 chairs).
  // Per-chair bookings are validated to be non-empty in the service.
  @IsArray()
  @IsNumber({}, { each: true })
  selectedChairIndices: number[];

  @IsString()
  visitorName: string;

  @IsEmail()
  visitorEmail: string;

  @IsString()
  visitorPhone: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeatGuestDto)
  seatGuests?: SeatGuestDto[];

  // Operator referral code from the shared event link (?ref=) — optional.
  // Only used to attribute the booking to that operator; the service
  // resolves it against the event's organizer and ignores unknown codes.
  @IsOptional()
  @IsString()
  referralCode?: string;
}
