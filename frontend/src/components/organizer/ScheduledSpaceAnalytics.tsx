import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleSlash,
  Download,
  Loader2,
  Users,
  LayoutGrid,
  Wallet,
  Clock,
  UserCheck,
} from "lucide-react";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";

const apiURL = __API_URL__;

type SlotState = "available" | "partial" | "full";

const STATE_STYLE: Record<SlotState, string> = {
  available: "bg-green-100 text-green-700 border-green-200",
  partial: "bg-amber-100 text-amber-700 border-amber-200",
  full: "bg-red-100 text-red-700 border-red-200",
};
const STATE_LABEL: Record<SlotState, string> = {
  available: "Open",
  partial: "Filling",
  full: "Full",
};

function Tile({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  tone?: "default" | "green" | "amber" | "blue" | "red";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted/50 text-stone-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] opacity-75">{sub}</div>}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

const fmtTime = (s: any) => `${s.startTime}–${s.endTime}`;

/**
 * Scheduled Spaces analytics: how full every facility's time slots are, how
 * many seats are left in each, who booked them, and the request funnel and
 * revenue. All figures come from GET /scheduled-spaces/analytics/:eventId,
 * which reads the same ledgers the visitor-side slot picker uses.
 */
export function ScheduledSpaceAnalytics({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${apiURL}/scheduled-spaces/analytics/${eventId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "Failed to load");
        if (!cancelled) setData(json.data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const spaceSummary = (sp: any) => {
    const capacity = sp.slots.reduce((n: number, s: any) => n + s.capacity, 0);
    const booked = sp.slots.reduce((n: number, s: any) => n + s.booked, 0);
    const full = sp.slots.filter((s: any) => s.state === "full").length;
    return { capacity, booked, full };
  };

  const rows = useMemo(() => {
    if (!data) return [] as string[][];
    const out: string[][] = [
      [
        "Space",
        "Facility Type",
        "For Sale",
        "Date",
        "Start",
        "End",
        "Capacity",
        "Booked",
        "Remaining",
        "Status",
        "Booked By",
      ],
    ];
    for (const sp of data.spaces) {
      for (const sl of sp.slots) {
        out.push([
          sp.name,
          sp.facilityType,
          sp.forSale ? "Yes" : "No",
          sl.date,
          sl.startTime,
          sl.endTime,
          String(sl.capacity),
          String(sl.booked),
          String(sl.remaining),
          STATE_LABEL[sl.state as SlotState],
          (sl.holders || [])
            .map((h: any) => `${h.name} (${h.persons})`)
            .join("; "),
        ]);
      }
    }
    return out;
  }, [data]);

  const exportCsv = () => {
    const csv = rows
      .map((r) =>
        r
          .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
          .join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(eventTitle).replace(/[^a-z0-9]/gi, "_")}_Scheduled_Spaces_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Loading scheduled space analytics…
      </div>
    );
  }
  if (error) {
    return <div className="py-12 text-center text-red-500">{error}</div>;
  }
  if (!data || data.spaces.length === 0) {
    return (
      <div className="py-14 text-center text-muted-foreground">
        <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />
        No Scheduled Spaces were placed for this event.
      </div>
    );
  }

  const t = data.totals;
  const r = data.requests;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Seats left per time slot, who booked, and the request funnel.
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Capacity overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Spaces" value={t.spaces} icon={<LayoutGrid className="h-3.5 w-3.5" />} />
        <Tile label="Time slots" value={t.slots} icon={<Clock className="h-3.5 w-3.5" />} />
        <Tile
          label="Occupancy"
          value={`${t.occupancy}%`}
          sub={`${t.booked} of ${t.capacity} seats`}
          tone="blue"
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <Tile
          label="Open slots"
          value={t.slotsAvailable}
          sub="nobody booked yet"
          tone="green"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <Tile
          label="Filling"
          value={t.slotsPartial}
          sub="some seats taken"
          tone="amber"
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <Tile
          label="Full slots"
          value={t.slotsFull}
          sub={`${t.capacityRemaining} seats left overall`}
          tone="red"
          icon={<CircleSlash className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Requests & money */}
      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Bookings &amp; revenue</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile
            label="Registered"
            value={r.total}
            sub={`${r.registeredNoSlots} yet to pick a slot`}
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <Tile
            label="Awaiting approval"
            value={r.byStatus.Processing || 0}
            tone="amber"
            icon={<Clock className="h-3.5 w-3.5" />}
          />
          <Tile
            label="Confirmed"
            value={r.byStatus.Completed || 0}
            sub={`${r.checkedIn} checked in`}
            tone="green"
            icon={<UserCheck className="h-3.5 w-3.5" />}
          />
          <Tile
            label="People booked"
            value={r.people}
            icon={<Users className="h-3.5 w-3.5" />}
          />
          <Tile
            label="Revenue (confirmed)"
            value={formatPrice(r.revenueConfirmed)}
            tone="green"
            icon={<Wallet className="h-3.5 w-3.5" />}
          />
          <Tile
            label="Revenue (pending)"
            value={formatPrice(r.revenuePending)}
            tone="amber"
            icon={<Wallet className="h-3.5 w-3.5" />}
          />
        </div>
        {((r.byStatus.Cancelled || 0) > 0 || (r.byStatus.Rejected || 0) > 0) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {r.byStatus.Cancelled || 0} cancelled · {r.byStatus.Rejected || 0} rejected
          </p>
        )}
      </div>

      {/* By facility type */}
      {data.byFacility.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-stone-700">By facility type</p>
          <div className="divide-y rounded-xl border">
            {data.byFacility.map((f: any) => (
              <div key={f.facilityType} className="space-y-1.5 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-stone-800">{f.facilityType}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.spaces} space{f.spaces === 1 ? "" : "s"} · {f.slots} slots ·{" "}
                    {f.slotsFull} full · {f.booked}/{f.capacity} seats
                  </span>
                </div>
                <Bar value={f.booked} max={f.capacity} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Every space → its slots */}
      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">
          Spaces &amp; time slots
        </p>
        <div className="divide-y rounded-xl border">
          {data.spaces.map((sp: any) => {
            const isOpen = open.has(sp.positionId);
            const sum = spaceSummary(sp);
            return (
              <div key={sp.positionId} className={sp.forSale ? "" : "opacity-60"}>
                <button
                  type="button"
                  onClick={() => toggle(sp.positionId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-stone-800">{sp.name}</span>
                      <Badge variant="secondary">{sp.facilityType}</Badge>
                      {!sp.forSale && <Badge variant="outline">Not for sale</Badge>}
                      {sp.forSale && sp.shared && (
                        <Badge variant="outline">Up to {sp.maxPersons} per slot</Badge>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <Bar value={sum.booked} max={sum.capacity} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>
                      {sum.booked}/{sum.capacity} seats
                    </div>
                    <div>
                      {sp.slots.length} slot{sp.slots.length === 1 ? "" : "s"} · {sum.full} full
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    {sp.slots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No time slots defined.</p>
                    ) : (
                      <div className="space-y-2">
                        {sp.slots.map((sl: any) => (
                          <div
                            key={sl.slotId}
                            className="rounded-lg border bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm">
                                <span className="font-medium">
                                  {new Date(`${sl.date}T00:00:00`).toDateString()}
                                </span>{" "}
                                <span className="text-muted-foreground">
                                  {fmtTime(sl)}
                                  {sl.label ? ` · ${sl.label}` : ""}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {sp.shared
                                    ? `${sl.booked}/${sl.capacity} seats · ${sl.remaining} left`
                                    : sl.booked
                                      ? "Booked"
                                      : "Available"}
                                </span>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATE_STYLE[sl.state as SlotState]}`}
                                >
                                  {STATE_LABEL[sl.state as SlotState]}
                                </span>
                              </div>
                            </div>
                            {sp.shared && <div className="mt-2"><Bar value={sl.booked} max={sl.capacity} /></div>}
                            {sl.holders.length > 0 && (
                              <ul className="mt-2 space-y-1 text-xs">
                                {sl.holders.map((h: any, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-center justify-between gap-2"
                                  >
                                    <span className="truncate">
                                      {h.name}
                                      <span className="text-muted-foreground">
                                        {" "}
                                        · {h.persons} person{h.persons === 1 ? "" : "s"}
                                      </span>
                                    </span>
                                    <Badge variant="secondary">
                                      {h.status === "Completed" ? "Confirmed" : "Awaiting approval"}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ScheduledSpaceAnalytics;
