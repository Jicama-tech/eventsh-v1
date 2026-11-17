import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgentBreakdown } from "@/lib/eventReportPdf";

const SECTION_NAMES: Record<string, string> = {
  visitors: "Tickets",
  exhibitors: "Exhibitors",
  roundTables: "Round tables",
  workshops: "Workshops",
  scheduledSpaces: "Scheduled spaces",
  speakers: "Speakers",
};

/**
 * Agent performance for the Event Intelligence dialog: via-agents vs direct,
 * agents ranked by revenue with a per-section split, and every booking made
 * through an agent. Same numbers as the PDF / Excel export.
 */
export function AgentsAnalyticsPanel({
  agents,
  search,
  formatPrice,
}: {
  agents: AgentBreakdown;
  search: string;
  formatPrice: (v: number) => string;
}) {
  const total = agents.viaAgents.revenue + agents.direct.revenue;
  const pct = total > 0 ? (agents.viaAgents.revenue / total) * 100 : 0;
  const max = Math.max(1, ...agents.agents.map((a) => a.revenue));
  const q = search.toLowerCase();
  const bookings = (agents.bookings || []).filter((k) =>
    `${k.agentName} ${k.customer} ${k.item}`.toLowerCase().includes(q),
  );

  return (
    <ScrollArea className="h-[calc(90vh-200px)] w-full">
      <div className="p-6 space-y-6">
        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-2 text-xs font-bold mb-2">
            <span className="text-indigo-600">
              Via agents: {formatPrice(agents.viaAgents.revenue)} ·{" "}
              {agents.viaAgents.bookings} bookings ({Math.round(pct)}%)
            </span>
            <span className="text-muted-foreground">
              Direct: {formatPrice(agents.direct.revenue)} ·{" "}
              {agents.direct.bookings} bookings
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="space-y-3">
          {agents.agents.map((a, i) => (
            <div key={a.id} className="rounded-xl border p-4">
              <div className="flex justify-between items-center gap-3 mb-2">
                <div className="font-bold text-sm">
                  #{i + 1} {a.name}
                  {a.code && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground">
                      {a.code}
                    </span>
                  )}
                  {!a.isActive && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      Off
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-black text-green-600">
                  {formatPrice(a.revenue)}{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    · {a.bookings} paid
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${(a.revenue / max) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(a.bySection).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">
                    {SECTION_NAMES[k] || k}: {v!.bookings} ·{" "}
                    {formatPrice(v!.revenue)}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {bookings.length > 0 && (
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                {["Agent", "Section", "Customer", "Booked", "Amount", "Status"].map(
                  (h) => (
                    <TableHead
                      key={h}
                      className="text-[11px] uppercase font-bold bg-muted"
                    >
                      {h}
                    </TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((k, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{k.agentName}</TableCell>
                  <TableCell>{SECTION_NAMES[k.section] || k.section}</TableCell>
                  <TableCell>{k.customer || "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {k.item || "—"}
                  </TableCell>
                  <TableCell>{formatPrice(k.amount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={k.counted ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {k.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </ScrollArea>
  );
}
