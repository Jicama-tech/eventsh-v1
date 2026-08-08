import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

// Which (space, slot) pair the registrant picked. Only identity fields are
// trusted from the client — price/name/date/time are always re-resolved
// server-side from the event's placed instances before this is persisted.
export class SelectedSlotDto {
  @IsString()
  positionId: string;

  @IsString()
  templateId: string;

  @IsString()
  slotId: string;
}

// Phase 2 — registrant picks one or more space+slot pairs and submits
// payment proof, mirroring Stalls' select-tables-and-addons shape but
// without any add-on concept.
export class SelectSlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedSlotDto)
  selectedSlots: SelectedSlotDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  paidAmount?: number;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  transactionScreenshot?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
