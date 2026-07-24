import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Public quotation submission from a supplier via the private link. Sent as
 * multipart/form-data (optional quotation attachment), so the structured
 * fields (`quotationItems`, `accountDetails`) arrive as JSON strings and are
 * parsed in the service. `token` gates the submission.
 */
export class CreateSupplierRequestDto {
  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  whatsAppNumber?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  serviceCategory?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  country?: string;

  // JSON array string: [{ requirementLabel, price, note }]
  @IsOptional()
  @IsString()
  quotationItems?: string;

  // Number or numeric string; if omitted the service sums the line items.
  @IsOptional()
  quotationTotal?: number | string;

  @IsOptional()
  @IsString()
  quotationNotes?: string;

  // ISO date string.
  @IsOptional()
  @IsString()
  validUntil?: string;

  // JSON object string: { accountHolderName, bankName, accountNumber,
  // ifscSwiftUen, upiPaynowId, country }
  @IsOptional()
  @IsString()
  accountDetails?: string;
}
