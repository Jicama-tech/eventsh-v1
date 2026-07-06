// Top-level event grouping shown in the "Create Event" pre-step chooser.
// An event is first classed as Commercial or Personal, then given a
// sub-type from that group's fixed list. The chosen sub-type is written
// to the event's `category` field (so existing reports/filters keep
// working) while the group is stored on the new `eventType` field.
//
// Lists are intentionally fixed — organizers pick from these, they don't
// add their own. Edit this file to change the available sub-types.

export type EventTypeKey = "commercial" | "personal";

export interface EventTypeGroup {
  key: EventTypeKey;
  label: string;
  description: string;
  subtypes: string[];
}

export const EVENT_TYPE_GROUPS: Record<EventTypeKey, EventTypeGroup> = {
  commercial: {
    key: "commercial",
    label: "Commercial",
    description: "Business & public events — ticketing, stalls, exhibitors.",
    subtypes: [
      "Conference",
      "Exhibition",
      "Bazaar",
      "Trade Show",
      "Seminar",
      "Workshop",
      "Product Launch",
      "Networking Event",
      "Job Fair",
    ],
  },
  personal: {
    key: "personal",
    label: "Personal",
    description: "Private celebrations & family functions — invite-led.",
    subtypes: [
      "Birthday Party",
      "Housewarming Party",
      "Marriage Function",
      "Engagement Ceremony",
      "Anniversary",
      "Baby Shower",
      "Reunion",
      "Farewell Party",
    ],
  },
};

export const EVENT_TYPE_LIST: EventTypeGroup[] = [
  EVENT_TYPE_GROUPS.commercial,
  EVENT_TYPE_GROUPS.personal,
];

// True when `value` is one of the known top-level event types.
export function isEventTypeKey(value: unknown): value is EventTypeKey {
  return value === "commercial" || value === "personal";
}

// The fixed sub-type list for a given event type, or [] if unknown.
export function subtypesFor(eventType: unknown): string[] {
  return isEventTypeKey(eventType)
    ? EVENT_TYPE_GROUPS[eventType].subtypes
    : [];
}

// Human label for an event type key ("commercial" -> "Commercial").
export function eventTypeLabel(eventType: unknown): string {
  return isEventTypeKey(eventType) ? EVENT_TYPE_GROUPS[eventType].label : "";
}
