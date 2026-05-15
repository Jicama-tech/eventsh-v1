import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
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
