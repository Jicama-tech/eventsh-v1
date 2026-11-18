// Participants, counted one way everywhere. The backend
// (GET /analytics/organizer/:id/participants) does the counting - tickets and
// seats, exhibitors, speakers, sponsors, round-table seats, workshops and
// scheduled spaces - so the dashboard and the Participants tab can't disagree.

export interface EventParticipants {
  eventId: string;
  total: number;
  visitors: number;
  exhibitors: number;
  speakers: number;
  roundTables: number;
  workshops: number;
  scheduledSpaces: number;
  sponsors: number;
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
  | "scheduledSpaces"
  | "sponsors";

export const PARTICIPANT_KINDS: { key: ParticipantKind; label: string }[] = [
  { key: "visitors", label: "Visitors" },
  { key: "exhibitors", label: "Exhibitors" },
  { key: "speakers", label: "Speakers" },
  { key: "roundTables", label: "Round table seats" },
  { key: "workshops", label: "Workshops" },
  { key: "scheduledSpaces", label: "Scheduled spaces" },
  { key: "sponsors", label: "Sponsors" },
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

/** An event agent as offered in the Participants tab's Agent filter. */
export interface AgentOption {
  id: string;
  name: string;
  code: string;
}

/** "all" shows everyone; "direct" only bookings with no agent; otherwise an agent id. */
export type AgentFilterValue = string;

/** Does this booking belong under the chosen Agent filter? */
export function matchesAgent(
  booking: { referralAgentId?: unknown } | null | undefined,
  filter: AgentFilterValue | undefined,
): boolean {
  if (!filter || filter === "all") return true;
  const id = booking?.referralAgentId ? String(booking.referralAgentId) : "";
  return filter === "direct" ? !id : id === filter;
}
