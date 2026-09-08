// Analytics page for the Individual dashboard.
//
// Deliberately NOT the organizer's DashboardOverview. That component builds
// every request from the JWT `sub`, which for an Individual is their User id —
// while their events hang off an Organizer row that ensureIndividualOrganizer
// creates keyed on *email*. The ids differ, so the organizer dashboard would
// render an empty shell. It is also the wrong content: it leads on stalls,
// exhibitor bookings and revenue splits, none of which an Individual has.
//
// Instead this reads the same structured "my events" chatbot intent that
// My Events and Participants use — the one source that resolves the backing
// organizer by email — and reports what an Individual actually has: how many
// events, how many people are coming, and how full each event is.

import { useEffect, useMemo, useState } from "react";
import { statAccent } from "@/lib/accents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Loader2,
  Users,
} from "lucide-react";
import { t } from "@/i18n/t";

interface EventCard {
  id: string;
  title?: string;
  date?: string;
  status?: string;
  isRsvp?: boolean;
  /** Attending headcount for RSVP events, tickets sold for ticketed ones. */
  ticketCount?: number;
  revenue?: number;
  currency?: string;
  capacityTotal?: number;
}

const apiURL = __API_URL__;

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? "—"
    : dt.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

export default function IndividualAnalytics() {
  const [events, setEvents] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        if (!cancelled) setError(e?.message || "Could not load your analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
    const upcoming = events.filter((e) => {
      const d = e.date ? new Date(e.date).getTime() : NaN;
      return !isNaN(d) && d >= now;
    }).length;
    const attendees = events.reduce((s, e) => s + num(e.ticketCount), 0);
    const capacity = events.reduce((s, e) => s + num(e.capacityTotal), 0);
    const revenue = events.reduce((s, e) => s + num(e.revenue), 0);
    return {
      total: events.length,
      upcoming,
      published: events.filter((e) => (e.status || "").toLowerCase() === "published")
        .length,
      attendees,
      capacity,
      revenue,
      // Only shown when something is actually priced — an Individual's events
      // are free, so a permanent "$0" tile would be noise rather than a metric.
      currency: events.find((e) => e.currency)?.currency || "",
      fill: capacity > 0 ? Math.round((attendees / capacity) * 100) : null,
    };
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/10 p-6 text-center text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("No events yet")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Create your first event and this page will show how many people are
            coming, and how full each event is.
          </p>
        </CardContent>
      </Card>
    );
  }

  // One accent per tile, from the shared --stat-* palette, so the row reads
  // as distinct metrics rather than five identical blue chips.
  // Colours come from lib/accents by tile index — same palette the organizer
  // dashboard uses, so the two analytics pages read as one product.
  const tiles: Array<{ label: string; value: string; icon: typeof Users }> = [
    {
      label: t("Events"),
      value: String(stats.total),
      icon: CalendarCheck,
    },
    {
      label: t("Upcoming"),
      value: String(stats.upcoming),
      icon: CalendarClock,
    },
    {
      label: t("People coming"),
      value: String(stats.attendees),
      icon: Users,
    },
  ];
  if (stats.fill !== null) {
    tiles.push({
      label: t("Capacity filled"),
      value: `${stats.fill}%`,
      icon: BarChart3,
    });
  }
  if (stats.revenue > 0) {
    tiles.push({
      label: t("Revenue"),
      value: `${stats.currency}${stats.revenue.toLocaleString()}`,
      icon: BarChart3,
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold">{t("nav.dashboard")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("How your events are doing.")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((tile, i) => {
          const accent = statAccent(i);
          return (
          <Card key={tile.label} className={`border-l-4 ${accent.ring}`}>
            <CardContent className="flex items-center gap-3 p-4">
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${accent.chip}`}
              >
                <tile.icon className={`h-5 w-5 ${accent.icon}`} />
              </span>
              <div className="min-w-0">
                <p className={`text-xl font-bold leading-tight ${accent.icon}`}>
                  {tile.value}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {tile.label}
                </p>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5" />
            {t("Per event")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table from md up, stacked cards below — the same responsive
              treatment EventRsvpPanel uses for its guest list. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t("Event")}</th>
                  <th className="py-2 pr-3 font-medium">{t("Date")}</th>
                  <th className="py-2 pr-3 font-medium">{t("Status")}</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    {t("Coming")}
                  </th>
                  <th className="py-2 text-right font-medium">
                    {t("Capacity")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{ev.title}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {fmtDate(ev.date)}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground capitalize">
                      {ev.status || "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">
                      {ev.ticketCount ?? 0}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {ev.capacityTotal ? ev.capacityTotal : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-lg border p-3">
                <p className="font-medium">{ev.title}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(ev.date)} · <span className="capitalize">{ev.status}</span>
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{ev.ticketCount ?? 0}</span>{" "}
                  <span className="text-muted-foreground">
                    {t("coming")}
                    {ev.capacityTotal ? ` / ${ev.capacityTotal}` : ""}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
