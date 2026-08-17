import { IsIn, IsMongoId, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RegisterInstanceDto {
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsNotEmpty()
  @IsString()
  domain: string;

  // Defaults to "full-instance" (a fully separate Docker deployment,
  // Phases 1-3) when omitted — every registration before this field existed
  // was one, so the default preserves exact prior behavior.
  @IsOptional()
  @IsIn(["full-instance", "api-client"])
  integrationType?: "full-instance" | "api-client";

  // Required (checked in the service, not here — class-validator can't
  // express "required only when integrationType === X" declaratively)
  // when integrationType is "api-client": the real Organizer._id this
  // integration is scoped to.
  @IsOptional()
  @IsMongoId()
  organizerId?: string;
}
