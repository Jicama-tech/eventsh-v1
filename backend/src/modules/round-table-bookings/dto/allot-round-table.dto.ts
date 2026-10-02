import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";

// Organizer assigns a table (and, in chair mode, the exact chairs) to an
// organizer-allotted booking that is still waiting for one.
export class AllotRoundTableDto {
  @IsString()
  tablePositionId: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  selectedChairIndices?: number[];
}
