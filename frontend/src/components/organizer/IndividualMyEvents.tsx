// My Events page for the Individual (chatbot) dashboard.
//
// Individuals don't get the heavy professional MyEvents UI. Instead this shows
// the SAME event-card list the assistant renders in chat — fetched from the
// same structured "my events" chatbot intent so the cards stay identical
// (title, date, status, RSVP/ticket count, open/storefront links). Actions are
// delegated to the dashboard: edit opens the (marriage) event form, Guest List
// jumps to the guest-list tab for that event.

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Crown,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface IndividualEventCard {
  id: string;
  title: string;
  date?: string;
  status?: string;
  ticketCount?: number;
  revenue?: number;
  currency?: string;
  ticketTypeCount?: number;
  ticketTypeNames?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  capacityTotal?: number;
  publicUrl?: string;
  storeUrl?: string;
  isRsvp?: boolean;
}

const apiURL = __API_URL__;

export default function IndividualMyEvents({
  onEditEvent,
  onCreateEvent,
  onOpenGuestList,
}: {
  onEditEvent: (eventId: string, title?: string) => void;
  onCreateEvent: () => void;
  onOpenGuestList: (eventId: string, title?: string) => void;
}) {
  const [events, setEvents] = useState<IndividualEventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem("token");
      // Reuse the assistant's structured "my events" intent so the cards match
      // exactly what chat shows (no LLM call — this is a deterministic handler).
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
      setEvents(Array.isArray(data?.events) ? data.events : []);
    } catch (e: any) {
      setError(e?.message || "Could not load your events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold leading-tight">
              My Events
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {events.length
                ? `${events.length} event${events.length === 1 ? "" : "s"}`
                : "Your events"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={onCreateEvent} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" />
          Create
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading your events…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="buttonOutline" onClick={load}>
              Retry
            </Button>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Calendar className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            No events yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first event to get started — you can also just ask the
            Assistant to set it up for you.
          </p>
          <Button className="mt-4" onClick={onCreateEvent}>
            <Plus className="mr-1 h-4 w-4" />
            Create event
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-lg border bg-card p-3 shadow-sm"
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="truncate text-sm sm:text-base font-semibold text-foreground">
                  {ev.title}
                </div>
                {ev.status && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
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
                <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(ev.date).toLocaleDateString()}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
                <div className="flex items-center gap-1">
                  {ev.isRsvp ? (
                    <Users className="h-3 w-3 text-rose-500 dark:text-rose-300" />
                  ) : (
                    <Ticket className="h-3 w-3 text-primary" />
                  )}
                  <span className="font-medium">{ev.ticketCount ?? 0}</span>
                  <span className="text-muted-foreground">
                    {ev.isRsvp ? "RSVPs" : "sold"}
                  </span>
                </div>
                {(ev.ticketTypeCount ?? 0) > 0 && (
                  <div
                    className="flex items-center gap-1"
                    title={ev.ticketTypeNames?.join(", ")}
                  >
                    <Crown className="h-3 w-3 text-warning" />
                    <span className="font-medium">{ev.ticketTypeCount}</span>
                    <span className="text-muted-foreground">
                      {ev.ticketTypeCount === 1 ? "ticket type" : "ticket types"}
                    </span>
                  </div>
                )}
                {typeof ev.revenue === "number" && ev.revenue > 0 && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="font-medium">
                      {(ev.currency || "$") + ev.revenue.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button
                  onClick={() => onEditEvent(ev.id, ev.title)}
                  className="flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
                  title="Edit event"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                {ev.isRsvp && (
                  <button
                    onClick={() => onOpenGuestList(ev.id, ev.title)}
                    className="flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                    title="View RSVP guest list"
                  >
                    <Users className="h-3 w-3" />
                    Guest List
                  </button>
                )}
                {ev.publicUrl && (
                  <a
                    href={ev.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/15"
                    title="Open public event page"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
