// Read-only status-history timeline — a colored dot + status badge + note +
// "by <actor>" per entry, connected by a vertical line. Shared between the
// organizer's review dialogs and the visitor-facing status dialogs so every
// booking flow (Stalls, Scheduled Spaces, ...) shows its history the same
// way.
import { Badge } from "@/components/ui/badge";

export interface TimelineEntry {
  status?: string;
  note?: string;
  changedAt?: string | Date;
  changedBy?: string;
}

const dotFor = (status?: string) =>
  status === "Completed"
    ? "bg-green-500"
    : status === "Confirmed"
      ? "bg-blue-500"
      : status === "Rejected" || status === "Cancelled"
        ? "bg-red-500"
        : status === "Processing"
          ? "bg-amber-500"
          : "bg-gray-400";

export default function StatusTimeline({
  history,
  emptyLabel = "No activity recorded yet.",
}: {
  history: TimelineEntry[] | undefined | null;
  emptyLabel?: string;
}) {
  const entries = Array.isArray(history) ? history : [];
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const sorted = [...entries].sort(
    (a, b) =>
      new Date(a.changedAt || 0).getTime() -
      new Date(b.changedAt || 0).getTime(),
  );

  return (
    <ol className="relative border-l pl-4 space-y-4">
      {sorted.map((h, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${dotFor(
              h.status,
            )}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{h.status || "Updated"}</Badge>
            <span className="text-xs text-muted-foreground">
              {h.changedAt ? new Date(h.changedAt).toLocaleString() : "—"}
            </span>
          </div>
          {h.note && <p className="text-sm mt-1">{h.note}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            by <span className="font-medium">{h.changedBy || "System"}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
