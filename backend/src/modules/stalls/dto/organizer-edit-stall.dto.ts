import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SelectedTableDto, SelectedAddOnDto } from "./tableSelect.dto";

/**
 * Organizer-initiated edit of a stall's space + add-on allocation. The new
 * `selectedTables` must all belong to the vendor's preferred template(s); the
 * service recomputes totals and returns the extra amount to collect (if any).
 */
export class OrganizerEditStallDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedTableDto)
  selectedTables: SelectedTableDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedAddOnDto)
  selectedAddOns?: SelectedAddOnDto[];

  @IsOptional()
  @IsString()
  changedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
