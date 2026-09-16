import { PartialType } from "@nestjs/mapped-types";
import { CreateTicketDto } from "./create-ticket.dto";
import { IsEnum, IsOptional, IsBoolean, IsDateString } from "class-validator";
import { TicketStatus } from "../entities/ticket.entity";

// referralCode stays in the shape (an API-key integration that reads a ticket
// and PATCHes it back would otherwise be rejected by forbidNonWhitelisted),
// but update() drops it: attribution is fixed at purchase time.
export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsBoolean()
  isUsed?: boolean;

  @IsOptional()
  @IsBoolean()
  hasMarked?: boolean;

  @IsOptional()
  @IsDateString()
  usedAt?: string;
}
