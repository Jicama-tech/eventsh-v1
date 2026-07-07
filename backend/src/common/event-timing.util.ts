/**
 * Shared event-timing helpers. Used by the public booking flows (tickets,
 * stalls, speaker applications, round-table bookings) to refuse new
 * bookings/purchases once an event is over.
 */

type EventLike = {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
} | null | undefined;

/**
 * True when the event's end (its `endDate`, or `startDate` when no end date is
 * set) is already in the past. The end date is taken to the END of that
 * calendar day, so an event ending "today" is NOT yet considered past — a
 * `Date` stored with no time component (midnight) shouldn't lock bookings for
 * the whole final day.
 */
export function eventHasEnded(event: EventLike): boolean {
  if (!event) return false;
  const end = event.endDate || event.startDate;
  if (!end) return false;
  const d = new Date(end as any);
  if (isNaN(d.getTime())) return false;
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

/** Standard user-facing message when a booking is refused for a past event. */
export const EVENT_ENDED_MESSAGE =
  "This event has ended — ticket sales and bookings are closed.";
