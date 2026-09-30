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

  // Omitted for an organizer-allotted booking: the visitor then sends the
  // template (`templateId`) and how many seats they want instead, and the
  // organizer assigns the table later.
  @IsOptional()
  @IsString()
  tablePositionId?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  // Chair-mode organizer-allotted bookings only: how many seats to allot.
  // Whole-table templates always book the full table.
  @IsOptional()
  @IsNumber()
  requestedSeats?: number;

  // May be empty for a whole-table booking of a standing table (0 chairs)
  // or an organizer-allotted booking. Per-chair visitor-picked bookings
  // are validated to be non-empty in the service.
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  selectedChairIndices?: number[];

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
