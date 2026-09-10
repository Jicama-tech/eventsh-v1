import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

// Body shape shared by exhibitor / speaker / round-table submissions — all
// gated by a signed token that already encodes audience + subjectId, so the
// body only needs the rating + comment from the submitter.
export class SubmitTokenFeedbackDto {
  @IsString()
  token: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

// Visitor body — no token, gate on email match against sold tickets.
export class SubmitVisitorFeedbackDto {
  @IsEmail()
  email: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

// Public body — no token and no ticket. Anyone holding the shared link can
// submit, so the submitter names themselves and nothing here is trusted as
// identity.
export class SubmitPublicFeedbackDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comment?: string;
}
