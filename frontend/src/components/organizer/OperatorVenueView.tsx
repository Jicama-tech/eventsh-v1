import { useEffect, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Loader2, Info } from "lucide-react";
import { ExhibitorDetailDialog } from "./ExhibitorDetailDialog";
import type { StallRequest } from "./shopKeeper";

const apiURL = __API_URL__;

interface PositionedTable {
  positionId: string;
  id?: string;
  name?: string;
  tableName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isBooked?: boolean;
  bookedBy?: string;
  color?: string;
  venueConfigId?: string;
}

interface PositionedRoundTable {
  positionId: string;
  name?: string;
  x: number;
  y: number;
  rotation?: number;
  tableDiameter?: number;
  color?: string;
  venueConfigId?: string;
}

interface PositionedSpeakerZone {
  positionId: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  isMainStage?: boolean;
  venueConfigId?: string;
}

interface PositionedDoor {
  id: string;
  type: "entrance" | "exit";
  x: number;
  y: number;
  rotation?: number;
  // Shape + footprint stored by the designer. Defaults preserve the
  // legacy 50-unit circle when these fields are missing on older
  // saved events.
  shape?: "circle" | "square";
  width?: number;
  height?: number;
}

interface VenueConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  scale: number;
  gridSize: number;
  showGrid?: boolean;
  hasMainStage?: boolean;
}

interface AddOnItem {
  id: string;
  name: string;
  color?: string;
}

interface BookingInfo {
  vendorName: string;
  businessName?: string;
  businessType?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  totalPaid?: number;
  paymentStatus?: string;
  addOns: {
    id: string;
    name: string;
    quantity: number;
    price?: number;
    color?: string;
  }[];
}

/**
 * Flatten helper for layout collections that may be flat arrays OR
 * Record<configId, item[]>. Mirrors the convention in CreateEventForm.
 */
const flatten = <T,>(v: any): T[] => {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") return Object.values(v).flat() as T[];
  return [];
};

/**
 * Read-only venue layout shown to operators (inside the scanner page's "Venue"
 * tab). Renders every placed stall / round table / speaker zone / door of an
 * event so operators can match physical setup against the design. Booked
 * stalls additionally show colored dots for each purchased add-on and a hover
 * popover with vendor + business + add-ons.
 */
export function OperatorVenueView({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<any | null>(null);
  const [bookings, setBookings] = useState<Record<string, BookingInfo>>({});
  // positionId -> stallId, so the "View details" click can fetch the full
  // stall record from /stalls/:id (the per-event list only ships a trimmed
  // shopkeeper projection).
  const [positionToStallId, setPositionToStallId] = useState<
    Record<string, string>
  >({});
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  // Full stall record loaded when the operator drills in. Null while closed
  // or loading; ExhibitorDetailDialog accepts null and renders an empty body.
  const [selectedStall, setSelectedStall] = useState<StallRequest | null>(null);
  const [stallDialogOpen, setStallDialogOpen] = useState(false);
  const [loadingStall, setLoadingStall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = sessionStorage.getItem("token");
        const headers: Record<string, string> = token
          ? { Authorization: `Bearer ${token}` }
          : {};

        const [eventRes, stallsRes] = await Promise.all([
          fetch(`${apiURL}/events/${eventId}`, { headers }),
          fetch(`${apiURL}/stalls/event/${eventId}`, { headers }),
        ]);

        if (!eventRes.ok) throw new Error(`Event fetch failed (${eventRes.status})`);
        const eventJson = await eventRes.json();
        const eventData = eventJson?.data || eventJson;

        const map: Record<string, BookingInfo> = {};
        const stallIdMap: Record<string, string> = {};
        if (stallsRes.ok) {
          const stallsJson = await stallsRes.json();
          const stalls: any[] = stallsJson?.data || stallsJson || [];
          for (const stall of stalls) {
            const positions: any[] = stall?.selectedTables || [];
            const addOns = (stall?.selectedAddOns || []).map((a: any) => ({
              id: a.addOnId,
              name: a.name,
              quantity: a.quantity ?? 1,
              price: a.price,
              color: a.color,
            }));
            // The backend's /stalls/event/:id populates `shopkeeperId` as an
            // object with name/email/whatsAppNumber/shopName. Older docs may
            // store the vendor's info on top-level fields, so we fall back.
            const sk =
              stall?.shopkeeperId && typeof stall.shopkeeperId === "object"
                ? stall.shopkeeperId
                : null;
            const vendorName =
              sk?.name ||
              stall?.shopkeeper?.name ||
              stall?.shopkeeperName ||
              stall?.vendorName ||
              "Vendor";
            const businessName =
              sk?.shopName ||
              sk?.businessName ||
              stall?.shopkeeper?.businessName ||
              stall?.businessName ||
              stall?.shopkeeper?.organizationName;
            const vendorEmail =
              sk?.email ||
              stall?.shopkeeper?.email ||
              stall?.shopkeeperEmail;
            const vendorPhone =
              sk?.whatsAppNumber ||
              sk?.phoneNumber ||
              stall?.shopkeeperPhone;
            const businessType =
              sk?.businessType || sk?.businessCategory || stall?.businessType;
            const totalPaid = stall?.totalAmount ?? stall?.amount;
            const paymentStatus = stall?.paymentStatus;
            for (const p of positions) {
              const positionId = p?.positionId || p?._id;
              if (!positionId) continue;
              map[positionId] = {
                vendorName,
                businessName,
                businessType,
                vendorEmail,
                vendorPhone,
                totalPaid,
                paymentStatus,
                addOns,
              };
              if (stall?._id) stallIdMap[positionId] = stall._id;
            }
          }
        }

        if (!cancelled) {
          setEvent(eventData);
          setBookings(map);
          setPositionToStallId(stallIdMap);
          const configs: VenueConfig[] = eventData?.venueConfig || [];
          if (configs.length > 0) setSelectedConfigId(configs[0].id);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load venue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Re-fetch a single stall by id (used by the dialog after a note is added,
  // and as the underlying load in openStallDetails).
  const fetchStallById = async (stallId: string) => {
    const token = sessionStorage.getItem("token");
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const res = await fetch(`${apiURL}/stalls/${stallId}`, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || json;
  };

  // Drill into a stall: pulls the full StallRequest from /stalls/:id so the
  // shared dialog has the same level of detail organizers see. We open the
  // dialog immediately so the operator sees feedback (header + spinner)
  // rather than waiting on the network.
  const openStallDetails = async (positionId: string) => {
    const stallId = positionToStallId[positionId];
    if (!stallId) return;
    setSelectedStall(null);
    setStallDialogOpen(true);
    setLoadingStall(true);
    try {
      const data = await fetchStallById(stallId);
      if (data) setSelectedStall(data);
    } finally {
      setLoadingStall(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading venue layout…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!event) {
    return (
      <div className="text-sm text-slate-500 italic text-center py-8">
        No venue data found for this event.
      </div>
    );
  }

  const venueConfigs: VenueConfig[] = event.venueConfig || [];
  if (venueConfigs.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic text-center py-8">
        No venue layouts defined for this event.
      </div>
    );
  }
  const venueConfig =
    venueConfigs.find((vc) => vc.id === selectedConfigId) || venueConfigs[0];

  const addOnItems: AddOnItem[] = event.addOnItems || [];
  const addOnColorMap = new Map(
    addOnItems.map((a) => [a.id, { color: a.color || "#6b7280", name: a.name }]),
  );

  // Filter layout items to the currently selected venue config.
  const matchesConfig = (item: any) =>
    !item?.venueConfigId || item.venueConfigId === venueConfig.id;

  const tables = flatten<PositionedTable>(event.venueTables).filter(matchesConfig);
  const rounds = flatten<PositionedRoundTable>(event.venueRoundTables).filter(
    matchesConfig,
  );
  const zones = flatten<PositionedSpeakerZone>(event.venueSpeakerZones).filter(
    matchesConfig,
  );
  const doors = flatten<PositionedDoor>(event.venueDoors).filter(
    (d) => !(d as any)?.venueConfigId || (d as any).venueConfigId === venueConfig.id,
  );

  return (
    <div className="space-y-4">
      {/* Venue selector (only when multiple) */}
      {venueConfigs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {venueConfigs.map((vc) => (
            <button
              key={vc.id}
              type="button"
              onClick={() => setSelectedConfigId(vc.id)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                vc.id === venueConfig.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {vc.name}
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="rounded-md border bg-slate-50 px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
        <span className="font-semibold uppercase tracking-wide">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-sm" />
          Booked stall
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-slate-300 rounded-sm" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-purple-400 rounded-sm" />
          Stage / zone
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-amber-300 rounded-full" />
          Round table
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-emerald-600 rounded-full" />
          Entrance
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-rose-600 rounded-full" />
          Exit
        </span>
        <span className="ml-auto text-slate-500">
          Hover a booked stall to see vendor + add-ons
        </span>
      </div>

      {/* Canvas */}
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 overflow-auto flex justify-center items-start p-4">
        <div
          className="relative bg-white border-2 border-gray-200 shadow-xl rounded-lg"
          style={{
            width: venueConfig.width * venueConfig.scale,
            height: venueConfig.height * venueConfig.scale,
            backgroundImage: venueConfig.showGrid
              ? `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`
              : "none",
            backgroundSize: `${venueConfig.gridSize * venueConfig.scale}px ${
              venueConfig.gridSize * venueConfig.scale
            }px`,
          }}
        >
          {venueConfig.hasMainStage && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-purple-100 border border-purple-300 px-4 py-1 rounded-md text-[9px] font-bold text-purple-700">
              MAIN STAGE
            </div>
          )}

          {/* Doors — circle (legacy / round) or square (resizable
              doorway). Honour the stored width/height + shape so the
              scanner view matches what the organizer placed. */}
          {doors.map((door) => {
            const isEntrance = door.type === "entrance";
            const isSquare = door.shape === "square";
            const w = Number(door.width) > 0 ? Number(door.width) : 50;
            const h = Number(door.height) > 0 ? Number(door.height) : 50;
            return (
              <div
                key={door.id}
                className={`absolute flex items-center justify-center text-[9px] font-bold text-white shadow ${
                  isSquare ? "rounded-md" : "rounded-full"
                } ${
                  isEntrance
                    ? "bg-emerald-600 border-2 border-emerald-700"
                    : "bg-rose-600 border-2 border-rose-700"
                }`}
                style={{
                  left: door.x * venueConfig.scale,
                  top: door.y * venueConfig.scale,
                  width: w * venueConfig.scale,
                  height: h * venueConfig.scale,
                  transform: `rotate(${door.rotation || 0}deg)`,
                }}
                title={isEntrance ? "Entrance" : "Exit"}
              >
                {isEntrance ? "IN" : "OUT"}
              </div>
            );
          })}

          {/* Speaker zones */}
          {zones.map((zone) => (
            <div
              key={`sz-${zone.positionId}`}
              className="absolute rounded-md border-2 flex items-center justify-center text-[9px] font-bold text-white shadow"
              style={{
                left: zone.x * venueConfig.scale,
                top: zone.y * venueConfig.scale,
                width: zone.width * venueConfig.scale,
                height: zone.height * venueConfig.scale,
                background: zone.isMainStage
                  ? "linear-gradient(135deg,#a855f7,#8b5cf6)"
                  : "linear-gradient(135deg,#9ca3af,#6b7280)",
                borderColor: zone.isMainStage ? "#7c3aed" : "#4b5563",
                transform: `rotate(${zone.rotation || 0}deg)`,
              }}
              title={zone.name}
            >
              {zone.isMainStage ? "STAGE" : zone.name}
            </div>
          ))}

          {/* Round tables */}
          {rounds.map((rt) => {
            const d = (rt.tableDiameter || 120) * venueConfig.scale;
            return (
              <div
                key={`rt-${rt.positionId}`}
                className="absolute rounded-full border-2 flex items-center justify-center text-[9px] font-bold text-white shadow"
                style={{
                  left: rt.x * venueConfig.scale,
                  top: rt.y * venueConfig.scale,
                  width: d,
                  height: d,
                  background: rt.color || "#f59e0b",
                  borderColor: rt.color
                    ? `${rt.color}cc`
                    : "#d97706",
                  transform: `rotate(${rt.rotation || 0}deg)`,
                }}
                title={rt.name}
              >
                {rt.name}
              </div>
            );
          })}

          {/* Stalls */}
          {tables.map((table) => {
            const booking = bookings[table.positionId];
            const dots = (booking?.addOns || []).map((a) => ({
              id: a.id,
              name: addOnColorMap.get(a.id)?.name || a.name,
              color: addOnColorMap.get(a.id)?.color || "#6b7280",
              quantity: a.quantity,
              price: a.price,
            }));
            const isBooked = !!booking || !!table.isBooked;
            const stallLabel = table.tableName || table.name || "";
            const node = (
              <div
                key={table.positionId}
                className={`absolute rounded-sm border-2 flex flex-col items-center justify-center text-white shadow overflow-hidden ${
                  isBooked
                    ? ""
                    : "border-slate-400 bg-slate-300/70 text-slate-700"
                }`}
                style={{
                  left: table.x * venueConfig.scale,
                  top: table.y * venueConfig.scale,
                  width: table.width * venueConfig.scale,
                  height: table.height * venueConfig.scale,
                  transform: `rotate(${table.rotation || 0}deg)`,
                  background: isBooked
                    ? table.color || "#10b981"
                    : undefined,
                  borderColor: isBooked
                    ? `${table.color || "#10b981"}cc`
                    : undefined,
                  lineHeight: 1.1,
                }}
              >
                {booking ? (
                  <>
                    {/* Vendor name is the operator's primary signal — front
                        and centre. Stall id + business name as supporting
                        lines below, sized by available room. */}
                    <span
                      className="font-bold text-center leading-tight px-1 truncate w-full"
                      style={{ fontSize: 11 }}
                      title={booking.vendorName}
                    >
                      {booking.vendorName}
                    </span>
                    {booking.businessName && (
                      <span
                        className="text-center leading-tight px-1 truncate w-full opacity-90"
                        style={{ fontSize: 9 }}
                        title={booking.businessName}
                      >
                        {booking.businessName}
                      </span>
                    )}
                    {stallLabel && (
                      <span
                        className="text-center leading-tight px-1 truncate w-full opacity-70 mt-0.5"
                        style={{ fontSize: 8 }}
                      >
                        #{stallLabel}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-bold text-[9px] truncate px-1">
                    {stallLabel}
                  </span>
                )}
                {dots.length > 0 && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 flex gap-0.5"
                    style={{ bottom: 2 }}
                  >
                    {dots.slice(0, 8).map((d, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-white/80 shadow"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: d.color,
                        }}
                      />
                    ))}
                    {dots.length > 8 && (
                      <span className="text-[7px] font-bold text-white/90 ml-0.5">
                        +{dots.length - 8}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );

            // Hover popover only on booked stalls (the operator's primary
            // interest — what's actually deployed here and what add-ons it
            // came with).
            if (!booking) return node;
            return (
              <HoverCard key={table.positionId} openDelay={120}>
                <HoverCardTrigger asChild>{node}</HoverCardTrigger>
                <HoverCardContent
                  side="top"
                  align="center"
                  className="w-80 p-3"
                >
                  <div className="space-y-2">
                    <div>
                      <div className="font-semibold text-sm">
                        {table.tableName || table.name || "Stall"}
                      </div>
                      <div className="text-xs text-slate-600">
                        Booked by {booking.vendorName}
                      </div>
                      {booking.businessName && (
                        <div className="text-xs text-slate-500">
                          {booking.businessName}
                        </div>
                      )}
                      {booking.vendorEmail && (
                        <div className="text-[11px] text-muted-foreground">
                          {booking.vendorEmail}
                        </div>
                      )}
                      {booking.vendorPhone && (
                        <div className="text-[11px] text-muted-foreground">
                          {booking.vendorPhone}
                        </div>
                      )}
                      {booking.totalPaid != null && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Total paid:{" "}
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(Number(booking.totalPaid))}
                        </div>
                      )}
                    </div>
                    {dots.length === 0 ? (
                      <div className="text-xs italic text-muted-foreground">
                        No add-ons purchased.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Add-ons ({dots.length})
                        </div>
                        <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {dots.map((d, i) => (
                            <li
                              key={`${d.id}-${i}`}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                style={{ backgroundColor: d.color }}
                              />
                              <span className="flex-1 truncate">{d.name}</span>
                              {d.quantity > 1 && (
                                <span className="text-muted-foreground">
                                  × {d.quantity}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full mt-1"
                      disabled={!positionToStallId[table.positionId]}
                      onClick={() => openStallDetails(table.positionId)}
                    >
                      {loadingStall ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <Info className="h-3.5 w-3.5 mr-1" />
                      )}
                      View details
                    </Button>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      </div>

      {/* Volunteer/operator dialog. Same component the organizer's Exhibitors
          tab uses — minus the admin callbacks (Confirm Payment, Return
          Deposit), so operators can read every detail but can't take action. */}
      <ExhibitorDetailDialog
        open={stallDialogOpen}
        onOpenChange={(open) => {
          setStallDialogOpen(open);
          if (!open) setSelectedStall(null);
        }}
        stallRequest={selectedStall}
        onNoteAdded={async () => {
          const id = selectedStall?._id;
          if (!id) return;
          const data = await fetchStallById(id);
          if (data) setSelectedStall(data);
        }}
      />

      <div className="text-[11px] text-muted-foreground">
        Showing layout as designed by the organizer. Use this view to position
        physical stalls + their purchased add-ons on the venue floor.
      </div>
    </div>
  );
}

