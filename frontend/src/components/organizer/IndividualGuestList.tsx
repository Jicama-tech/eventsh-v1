// Guest List page for the Individual (chatbot) dashboard.
//
// Shows the individual's events as a list; tapping "View" on an event opens
// that event's RSVP guest list (EventRsvpPanel) with a back button to return.
// Can also deep-open a specific event via initialEventId (e.g. jumping in from
// a My Events card's Guest List button).
//
// Events come from the SAME structured "my events" chatbot intent that the
// assistant / My Events page use — an individual's events belong to a backing
// organizer resolved by email, so the plain /events/organizer/:id lookup can
// miss them. Using the chatbot source keeps all three views in sync.

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  CalendarHeart,
  Loader2,
  Users,
} from "lucide-react";
import EventRsvpPanel from "./EventRsvpPanel";

interface IndividualEventCard {
  id: string;
  title?: string;
  date?: string;
  status?: string;
  isRsvp?: boolean;
}

const apiURL = __API_URL__;

export default function IndividualGuestList({
  initialEventId,
}: {
  /** Deep-open this event's guest list directly (e.g. from a My Events card). */
  initialEventId?: string;
}) {
  const [events, setEvents] = useState<IndividualEventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string>(initialEventId || "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = sessionStorage.getItem("token");
        const res = await fetch(`${apiURL}/chatbot/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: "my events" }),
        });
        if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        setEvents(Array.isArray(data?.events) ? data.events : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load your events");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow an externally-selected event (parent jumped in from a specific card).
  useEffect(() => {
    if (initialEventId) setViewingId(initialEventId);
  }, [initialEventId]);

  const viewingEvent = useMemo(
    () => events.find((e) => e.id === viewingId),
    [events, viewingId],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  // --- Viewing one event's guest list ---
  if (viewingEvent) {
    return (
      <div className="space-y-3">
        <Button
          size="sm"
          variant="buttonOutline"
          className="h-8"
          onClick={() => setViewingId("")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to events
        </Button>
        <EventRsvpPanel
          key={viewingEvent.id}
          eventId={viewingEvent.id}
          eventTitle={viewingEvent.title}
          fullScreenOnMobile
        />
      </div>
    );
  }

  // --- Empty state ---
  if (!events.length) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
          <CalendarHeart className="h-7 w-7 text-rose-500 dark:text-rose-300" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No events yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your event first — ask the Assistant to set up your function,
          then your guests&apos; RSVPs will show up here.
        </p>
      </div>
    );
  }

  // --- Event list (pick one to view its guest list) ---
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
          <Users className="h-5 w-5 text-rose-500 dark:text-rose-300" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold leading-tight">
            Guest List
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Pick an event to view its guests
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm sm:text-base font-semibold text-foreground">
                  {ev.title || "Untitled event"}
                </div>
                {ev.status && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      ev.status === "published"
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {ev.status}
                  </span>
                )}
              </div>
              {ev.date && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(ev.date).toLocaleDateString()}
                </div>
              )}
            </div>
            <Button
              size="sm"
              className="h-8 shrink-0"
              onClick={() => setViewingId(ev.id)}
            >
              <Users className="mr-1 h-4 w-4" />
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
