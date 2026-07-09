import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  Min,
  Max,
} from "class-validator";

export class CreatePaymentFeedbackDto {
  @IsString()
  organizerId: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  eventTitle?: string;

  @IsIn(["vendor", "stall_edit", "visitor", "speaker", "round_table"])
  paymentType: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  payerName?: string;

  @IsOptional()
  @IsString()
  payerEmail?: string;

  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}
