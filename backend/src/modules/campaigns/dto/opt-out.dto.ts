import { IsBoolean } from "class-validator";

/** The campaign screen's "Marketing messages" switch for one contact. `true`
 * means the contact is NOT to be sent campaigns. */
export class SetOptOutDto {
  @IsBoolean()
  optedOut: boolean;
}
