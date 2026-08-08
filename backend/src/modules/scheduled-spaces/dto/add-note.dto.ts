import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AddScheduledSpaceNoteDto {
  @IsNotEmpty()
  @IsString()
  note: string;

  @IsOptional()
  @IsString()
  addedBy?: string;
}
