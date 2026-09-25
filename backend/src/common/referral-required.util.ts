import { BadRequestException } from "@nestjs/common";

export const REFERRAL_REQUIRED_MESSAGE =
  "This event can only be booked with a referral code. Enter the code your agent shared with you.";
export const REFERRAL_INVALID_MESSAGE =
  "This referral code is not valid for this event, or it has reached its limit. Ask your agent for the right code.";

/** The Agents section (event form → Venue → Event Sections → Agents) makes
 * the event referral-only. */
export function isReferralRequired(event: any): boolean {
  return !!event?.features?.hasAgents;
}

/**
 * Refuses a booking on a referral-only event unless the code resolved to one
 * of the event's agents or the organizer's operators. Called right after
 * `resolveReferral`, before anything is written. A typed code that did not
 * resolve gets the "not valid" message; an empty one the "needed" message.
 */
export function assertReferralIfRequired(
  event: any,
  referral: unknown,
  typedCode: unknown,
): void {
  if (!isReferralRequired(event) || referral) return;
  throw new BadRequestException(
    String(typedCode ?? "").trim()
      ? REFERRAL_INVALID_MESSAGE
      : REFERRAL_REQUIRED_MESSAGE,
  );
}
