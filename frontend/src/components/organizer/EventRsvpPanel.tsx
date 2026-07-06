import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Users,
  RefreshCw,
  Mail,
  Phone,
  Check,
  X,
  Download,
  Eye,
  BedDouble,
} from "lucide-react";
import GuestRoomDialog, { roomTypeLabel } from "./GuestRoomDialog";

const apiURL = __API_URL__;

interface RoomAllotment {
  id?: string;
  functionId: string;
  functionName: string;
  roomType: string;
  roomName: string;
  occupants: number;
  occupantNames?: string[];
  notes?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
}

interface RsvpRow {
  _id: string;
  name: string;
  email: string;
  contactNumber?: string;
  guestCount: number;
  message?: string;
  attending: boolean;
  side?: string;
  functions?: { id: string; name: string }[];
  attendees?: { name: string; age?: number; contactNumber?: string }[];
  ageGroups?: {
    adults?: number;
    seniors?: number;
    children?: number;
    infants?: number;
  };
  roomAllotments?: RoomAllotment[];
  createdAt?: string;
}

// "groom"/"bride" → a friendly label; anything else → em dash.
function sideLabel(side?: string): string {
  if (side === "groom") return "Groom's side";
  if (side === "bride") return "Bride's side";
  return "";
}

interface RsvpStats {
  responses: number;
  attendingResponses: number;
  totalGuests: number;
}

/**
 * Organizer view of the RSVP guest list for an event, shown in the
 * Participants tab when a Personal / Marriage event is selected.
 */
export default function EventRsvpPanel({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle?: string;
}) {
  const [rows, setRows] = useState<RsvpRow[]>([]);
  const [stats, setStats] = useState<RsvpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filter the list to guests coming to a particular function.
  const [functionFilter, setFunctionFilter] = useState("all");
  // The guest whose room-allotment dialog is open.
  const [allotGuest, setAllotGuest] = useState<RsvpRow | null>(null);

  // Function filter options — the union of functions guests have picked.
  const functionOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) =>
      (r.functions || []).forEach((f) => {
        if (f.id) map.set(f.id, f.name);
      }),
    );
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (functionFilter === "all") return rows;
    return rows.filter((r) =>
      (r.functions || []).some((f) => f.id === functionFilter),
    );
  }, [rows, functionFilter]);

  // Age-group totals across the currently-shown (filtered) attending guests.
  const ageTotals = useMemo(() => {
    const t = { adults: 0, seniors: 0, children: 0, infants: 0 };
    filteredRows.forEach((r) => {
      if (r.attending === false) return;
      const a = r.ageGroups || {};
      t.adults += a.adults || 0;
      t.seniors += a.seniors || 0;
      t.children += a.children || 0;
      t.infants += a.infants || 0;
    });
    return t;
  }, [filteredRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/events/${eventId}/rsvps`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load RSVPs (${res.status})`);
      const json = await res.json();
      setRows(Array.isArray(json?.data) ? json.data : []);
      setStats(json?.stats || null);
    } catch (e: any) {
      setError(e?.message || "Could not load RSVPs");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    const header = [
      "Name",
      "Email",
      "Contact",
      "Side",
      "Guests",
      "Adults",
      "Seniors",
      "Children",
      "Infants",
      "Guest List (name/age/contact)",
      "Attending",
      "Functions",
      "Rooms",
      "Message",
      "Date",
    ];
    const lines = filteredRows.map((r) =>
      [
        r.name,
        r.email,
        r.contactNumber || "",
        sideLabel(r.side),
        r.guestCount,
        r.ageGroups?.adults || 0,
        r.ageGroups?.seniors || 0,
        r.ageGroups?.children || 0,
        r.ageGroups?.infants || 0,
        (r.attendees || [])
          .map(
            (a) =>
              `${a.name}${a.age ? ` (${a.age})` : ""}${
                a.contactNumber ? ` ${a.contactNumber}` : ""
              }`,
          )
          .join("; "),
        r.attending ? "Yes" : "No",
        (r.functions || []).map((f) => f.name).join("; "),
        (r.roomAllotments || [])
          .map((a) => {
            const who =
              a.occupantNames && a.occupantNames.length
                ? ` — ${a.occupantNames.join(", ")}`
                : "";
            const room = a.roomName || "(unassigned)";
            return `${a.functionName ? `${a.functionName}: ` : ""}${room} [${roomTypeLabel(
              a.roomType,
            )}, ${a.occupants} pax]${who}`;
          })
          .join(" | "),
        (r.message || "").replace(/[\r\n,]+/g, " "),
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(eventTitle || "event").replace(/\s+/g, "-")}-rsvps.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <Card className="border-rose-200">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg">
          <span className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-rose-500" />
            RSVP Guest List
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            {rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-1 h-4 w-4" /> Export
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stat tiles */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat
            label="Responses"
            value={stats?.responses ?? rows.length}
            icon={<Mail className="h-4 w-4" />}
          />
          <Stat
            label="Attending"
            value={stats?.attendingResponses ?? 0}
            icon={<Check className="h-4 w-4" />}
            tone="green"
          />
          <Stat
            label="Total Guests"
            value={stats?.totalGuests ?? 0}
            icon={<Users className="h-4 w-4" />}
            tone="rose"
          />
        </div>

        {/* Age-group breakdown of the guests currently shown — helps the
            planner size catering and rooms. */}
        <div className="mb-4 grid grid-cols-4 gap-2">
          <AgeTile label="Adults" value={ageTotals.adults} />
          <AgeTile label="Seniors" value={ageTotals.seniors} />
          <AgeTile label="Children" value={ageTotals.children} />
          <AgeTile label="Infants" value={ageTotals.infants} />
        </div>

        {/* Filter to guests coming to a particular function. */}
        {functionOptions.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Coming to:
            </span>
            <Select value={functionFilter} onValueChange={setFunctionFilter}>
              <SelectTrigger className="h-8 w-auto min-w-[160px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All functions</SelectItem>
                {functionOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {functionFilter !== "all" && (
              <span className="text-xs text-muted-foreground">
                {filteredRows.length} guest
                {filteredRows.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading RSVPs…
          </p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-500">{error}</p>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center">
            <Heart className="mx-auto mb-3 h-8 w-8 text-rose-200" />
            <p className="text-sm text-muted-foreground">
              No RSVPs yet. Guests can respond from the public wedding page.
            </p>
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No guests are coming to this function yet.
          </p>
        ) : (
          <>
            {/* Desktop / tablet: a table. Kept inside overflow-x-auto so any
                overflow scrolls within the panel, never the whole dialog. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Guest</th>
                    <th className="px-2 py-2">Contact</th>
                    <th className="px-2 py-2">Side</th>
                    <th className="px-2 py-2 text-center">Guests</th>
                    <th className="px-2 py-2 text-center">Status</th>
                    <th className="px-2 py-2">Functions</th>
                    <th className="px-2 py-2">Message</th>
                    <th className="px-2 py-2 text-center">Rooms</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr
                      key={r._id}
                      className="border-b align-top last:border-0 hover:bg-rose-50/40"
                    >
                      <td className="px-2 py-3">
                        <div className="font-medium text-stone-800">
                          {r.name}
                        </div>
                        <div className="flex items-center gap-1 break-all text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 flex-shrink-0" /> {r.email}
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        {r.contactNumber ? (
                          <span className="flex items-center gap-1 text-stone-600">
                            <Phone className="h-3 w-3" /> {r.contactNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {sideLabel(r.side) ? (
                          <Badge
                            variant="outline"
                            className={
                              r.side === "groom"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-pink-200 bg-pink-50 text-pink-700"
                            }
                          >
                            {sideLabel(r.side)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center font-medium">
                        {r.attending ? r.guestCount : 0}
                        {r.attending && ageSummary(r.ageGroups) && (
                          <div className="text-[10px] font-normal leading-tight text-muted-foreground">
                            {ageSummary(r.ageGroups)}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        {r.attending ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <Check className="mr-1 h-3 w-3" /> Attending
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="mr-1 h-3 w-3" /> Declined
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {r.attending &&
                        r.functions &&
                        r.functions.length > 0 ? (
                          <div className="flex max-w-[200px] flex-wrap gap-1">
                            {r.functions.map((f) => (
                              <Badge
                                key={f.id || f.name}
                                variant="secondary"
                                className="bg-rose-50 text-rose-600"
                              >
                                {f.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[240px] px-2 py-3 text-stone-600">
                        {r.message || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => setAllotGuest(r)}
                          title="View guest & allot rooms"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {r.roomAllotments && r.roomAllotments.length > 0 ? (
                            <span className="inline-flex items-center gap-0.5">
                              <BedDouble className="h-3 w-3" />
                              {r.roomAllotments.length}
                            </span>
                          ) : (
                            "Allot"
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked cards — no horizontal scrolling. */}
            <div className="space-y-3 md:hidden">
              {filteredRows.map((r) => (
                <div
                  key={r._id}
                  className="rounded-xl border border-rose-100 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-stone-800">
                        {r.name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="break-all">{r.email}</span>
                      </div>
                    </div>
                    {r.attending ? (
                      <Badge className="flex-shrink-0 bg-green-100 text-green-700 hover:bg-green-100">
                        <Check className="mr-1 h-3 w-3" /> Attending
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex-shrink-0">
                        <X className="mr-1 h-3 w-3" /> Declined
                      </Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-600">
                    {sideLabel(r.side) && (
                      <Badge
                        variant="outline"
                        className={
                          r.side === "groom"
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-pink-200 bg-pink-50 text-pink-700"
                        }
                      >
                        {sideLabel(r.side)}
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {r.attending ? r.guestCount : 0} guest
                      {(r.attending ? r.guestCount : 0) === 1 ? "" : "s"}
                    </span>
                    {r.contactNumber && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {r.contactNumber}
                      </span>
                    )}
                  </div>

                  {r.attending && ageSummary(r.ageGroups) && (
                    <div className="mt-1.5 text-xs text-stone-500">
                      {ageSummary(r.ageGroups)}
                    </div>
                  )}

                  {r.attending && r.functions && r.functions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.functions.map((f) => (
                        <Badge
                          key={f.id || f.name}
                          variant="secondary"
                          className="bg-rose-50 text-rose-600"
                        >
                          {f.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {r.message && (
                    <p className="mt-2 text-sm text-stone-600">{r.message}</p>
                  )}

                  <button
                    onClick={() => setAllotGuest(r)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {r.roomAllotments && r.roomAllotments.length > 0
                      ? `${r.roomAllotments.length} room${
                          r.roomAllotments.length === 1 ? "" : "s"
                        } allotted`
                      : "View & allot rooms"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>

    <GuestRoomDialog
      eventId={eventId}
      guest={allotGuest}
      open={!!allotGuest}
      onOpenChange={(o) => !o && setAllotGuest(null)}
      onSaved={(allotments) => {
        setRows((old) =>
          old.map((r) =>
            r._id === allotGuest?._id
              ? { ...r, roomAllotments: allotments as RoomAllotment[] }
              : r,
          ),
        );
      }}
    />
    </>
  );
}

// Compact "2 adults · 1 child" summary of an RSVP's age breakdown.
function ageSummary(a?: RsvpRow["ageGroups"]): string {
  if (!a) return "";
  return [
    a.adults ? `${a.adults} adult${a.adults === 1 ? "" : "s"}` : "",
    a.seniors ? `${a.seniors} senior${a.seniors === 1 ? "" : "s"}` : "",
    a.children ? `${a.children} child${a.children === 1 ? "" : "ren"}` : "",
    a.infants ? `${a.infants} infant${a.infants === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function AgeTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
      <div className="text-lg font-semibold text-stone-800">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "green" | "rose";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted/50 text-stone-700",
    green: "bg-green-50 text-green-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <div className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
