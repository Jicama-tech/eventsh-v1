import { useEffect, useState } from "react";
import { Users, Store, Mic2, Circle, Star, Loader2 } from "lucide-react";

const apiURL = __API_URL__;

type Audience = "visitor" | "exhibitor" | "speaker" | "round_table";

interface StatsResponse {
  eventId: string;
  eventEnded: boolean;
  audiences: Record<
    Audience,
    { available: number; ratingCount: number; ratingAvg: number }
  >;
}

interface Props {
  eventId: string;
  // Past-event check is already done by the parent — this component just
  // renders the cards. Kept here as a safety net in case it's mounted early.
  eventEndDate?: string | Date;
}

const cardConfig: Record<
  Audience,
  { label: string; icon: typeof Users }
> = {
  visitor: { label: "Visitors", icon: Users },
  exhibitor: { label: "Exhibitors", icon: Store },
  speaker: { label: "Speakers", icon: Mic2 },
  round_table: { label: "Round Tables", icon: Circle },
};

export function EventStatistics({ eventId, eventEndDate }: Props) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-derive past-event check defensively in case the parent forgot.
  const ended = eventEndDate
    ? new Date(eventEndDate) <= new Date()
    : true;

  useEffect(() => {
    if (!eventId || !ended) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiURL}/events/${eventId}/stats`);
        if (!res.ok) throw new Error("stats fetch failed");
        const json = await res.json();
        if (!cancelled) setStats(json);
      } catch {
        // Silent — stats are optional surface, nothing else depends on them.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, ended]);

  if (!ended || !stats) {
    return loading && ended ? (
      <div className="flex items-center justify-center py-8 text-gray-400 gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading event statistics…
      </div>
    ) : null;
  }

  // Build the visible cards: only audiences with at least one booking
  // surface, and we always add a "Highest avg rating" card when ANY
  // audience has feedback so the rating story isn't lost.
  const audienceOrder: Audience[] = [
    "visitor",
    "exhibitor",
    "speaker",
    "round_table",
  ];
  const visibleAudiences = audienceOrder.filter(
    (a) => stats.audiences[a].available > 0,
  );

  if (visibleAudiences.length === 0) return null;

  // Overall rating: weighted average across audiences that received feedback.
  let ratingSum = 0;
  let ratingCount = 0;
  for (const a of audienceOrder) {
    const t = stats.audiences[a];
    ratingSum += t.ratingAvg * t.ratingCount;
    ratingCount += t.ratingCount;
  }
  const overallAvg =
    ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(2)) : 0;

  return (
    <section className="py-8 sm:py-12">
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold tracking-[0.25em] text-gray-400 uppercase">
          By the numbers
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {visibleAudiences.map((a) => {
          const { label, icon: Icon } = cardConfig[a];
          const t = stats.audiences[a];
          return (
            <div
              key={a}
              className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <Icon className="h-5 w-5 mb-6 sm:mb-8 text-blue-600" />
              <div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-1 text-gray-900">
                  {t.available}
                </div>
                <div className="text-xs sm:text-sm text-gray-500 tracking-wide mt-2">
                  {label}
                </div>
                {t.ratingCount > 0 && (
                  <div className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {t.ratingAvg} avg from {t.ratingCount}{" "}
                    {t.ratingCount === 1 ? "rating" : "ratings"}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {ratingCount > 0 && (
          <div className="rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col justify-between border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <Star className="h-5 w-5 mb-6 sm:mb-8 text-yellow-500 fill-yellow-500" />
            <div>
              <div className="flex items-end gap-1.5">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
                  {overallAvg}
                </span>
                <span className="text-gray-400 text-lg mb-1">/5</span>
              </div>
              <div className="text-xs sm:text-sm text-gray-500 tracking-wide mt-2">
                Overall Rating
              </div>
              <div className="text-[11px] text-gray-400 mt-3">
                from {ratingCount} responses
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
