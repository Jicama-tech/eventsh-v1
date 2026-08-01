import { IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { EXPENSE_CATEGORIES } from "../entities/event-expense.entity";

/**
 * Logging an out-of-pocket event cost. Who recorded it is taken from the
 * caller's JWT, not from these fields. Sent as multipart/form-data so a
 * receipt photo can ride along — every field arrives as a string and is
 * coerced in the service.
 */
export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  // Arrives as a string over multipart; the service coerces and validates it.
  @IsNotEmpty()
  amount: number | string;

  @IsOptional()
  @IsIn(EXPENSE_CATEGORIES as unknown as string[])
  category?: string;

  // ISO date string; defaults to now.
  @IsOptional()
  @IsString()
  spentAt?: string;

  @IsOptional()
  @IsString()
  paidTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;

}
