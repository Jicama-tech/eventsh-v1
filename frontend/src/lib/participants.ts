// Participants, counted one way everywhere. The backend
// (GET /analytics/organizer/:id/participants) does the counting - tickets and
// seats, exhibitors, speakers, round-table seats, workshops and scheduled
// spaces - so the dashboard and the Participants tab can't disagree.

export interface EventParticipants {
  eventId: string;
  total: number;
  visitors: number;
  exhibitors: number;
  speakers: number;
  roundTables: number;
  workshops: number;
  scheduledSpaces: number;
  /** Bookings still waiting on the organizer. */
  pending: number;
  /** Nothing on the event carries a price. */
  isFree: boolean;
}

export interface OrganizerParticipants {
  events: EventParticipants[];
  totals: Omit<EventParticipants, "eventId" | "isFree">;
}

export type ParticipantKind =
  | "visitors"
  | "exhibitors"
  | "speakers"
  | "roundTables"
  | "workshops"
  | "scheduledSpaces";

export const PARTICIPANT_KINDS: { key: ParticipantKind; label: string }[] = [
  { key: "visitors", label: "Visitors" },
  { key: "exhibitors", label: "Exhibitors" },
  { key: "speakers", label: "Speakers" },
  { key: "roundTables", label: "Round table seats" },
  { key: "workshops", label: "Workshops" },
  { key: "scheduledSpaces", label: "Scheduled spaces" },
];

/** Null when the call fails, so callers can fall back to their own figures. */
export async function fetchOrganizerParticipants(
  apiURL: string,
  organizerId: string,
  token: string | null,
): Promise<OrganizerParticipants | null> {
  try {
    const res = await fetch(
      `${apiURL}/analytics/organizer/${organizerId}/participants`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.data?.events) ? json.data : null;
  } catch {
    return null;
  }
}
