import {
  IsString,
  IsArray,
  IsNumber,
  IsEmail,
  IsMongoId,
  IsOptional,
  ArrayMinSize,
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

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
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
}
