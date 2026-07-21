import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsMongoId,
  IsObject,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class UpsertFormDraftDto {
  @IsMongoId()
  eventId: string;

  @IsEmail()
  email: string;

  @IsInt()
  @Min(1)
  @Max(3)
  subStep: number;

  // Text-only snapshot of the registration form fields.
  @IsObject()
  form: Record<string, any>;

  // Sent as true exactly once — when the vendor accepts the Rules &
  // Regulations gate. Never unset by later saves.
  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
