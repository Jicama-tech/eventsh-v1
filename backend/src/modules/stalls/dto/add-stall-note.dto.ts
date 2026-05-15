import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class AddStallNoteDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  note: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addedBy?: string;
}
