import { useEffect, useRef, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Info } from "lucide-react";
import { ExhibitorDetailDialog } from "./ExhibitorDetailDialog";
import SpaceLayout from "./SpaceLayout";
import type { StallRequest } from "./shopKeeper";

const apiURL = __API_URL__;

// Booking statuses that no longer occupy a space, so their tables read as free
// in the layout (kept in sync with EventSpaceAnalyticsDialog).
const DEAD_STATUSES = new Set(["Cancelled", "Rejected", "Declined"]);

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
  // Touch devices have no hover, so a tap opens this quick card (same content
  // as the desktop hover card); its "View details" button then opens the full
  // dialog — mirroring the two-step desktop flow.
  const [quickCard, setQuickCard] = useState<{ t: any; booking: any } | null>(
    null,
  );
  const [loadingStall, setLoadingStall] = useState(false);

  // Fit-to-width scaling, identical to the public eventfront map: the canvas
  // renders at natural size (1px per logical unit) and the whole thing is
  // CSS-scaled down to fit the container width, so spacing + sizing match the
  // eventfront exactly. extentsRef holds the latest computed canvas extents so
  // the ResizeObserver can read them without re-subscribing every render.
  const venueScrollRef = useRef<HTMLDivElement>(null);
  const extentsRef = useRef({ width: 800, height: 500 });
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const el = venueScrollRef.current;
    if (!el) return;
    const recompute = () => {
      const cw = el.clientWidth - 32; // minus the p-4 padding (16px each side)
      const canvasWidth = extentsRef.current.width;
      if (cw > 0 && canvasWidth > 0) {
        setFitScale(Math.max(0.05, Math.min((cw / canvasWidth) * 0.98, 1)));
      }
    };
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [event, selectedConfigId]);

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
            // A cancelled / rejected / declined booking no longer holds its
            // space — skip it so the layout shows those tables as free again
            // (mirrors the space-analytics dialog's DEAD_STATUSES). Hard-deleted
            // stalls simply don't come back from the fetch, so they free too.
            if (DEAD_STATUSES.has(stall?.status)) continue;
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

  // Quick card content (vendor + add-ons + "View details"). Shared by the
  // desktop hover card and the mobile tap dialog so both stay in sync.
  const renderQuickCard = (t: any, booking: any, onView: () => void) => {
    const dots = (booking.addOns || []).map((a: any) => ({
      id: a.id,
      name: addOnColorMap.get(a.id)?.name || a.name,
      color: addOnColorMap.get(a.id)?.color || "#6b7280",
      quantity: a.quantity,
      price: a.price,
    }));
    return (
      <div className="space-y-2">
        <div>
          <div className="font-semibold text-sm">
            {t.tableName || t.name || "Stall"}
          </div>
          <div className="text-xs text-slate-600">
            Booked by {booking.vendorName}
          </div>
          {booking.businessName && (
            <div className="text-xs text-slate-500">{booking.businessName}</div>
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
              {dots.map((d: any, i: number) => (
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
                    <span className="text-muted-foreground">× {d.quantity}</span>
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
          disabled={!positionToStallId[t.positionId]}
          onClick={onView}
        >
          {loadingStall ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Info className="h-3.5 w-3.5 mr-1" />
          )}
          View details
        </Button>
      </div>
    );
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

  // Which hall an item belongs to. Mirrors the eventfront's belongsToLayout so
  // a multi-venue event never merges halls: a real tag must match the selected
  // venue exactly; untagged / "default" items belong ONLY to the first hall
  // (legacy single-venue data) instead of leaking onto every venue.
  const layoutIndex = Math.max(
    0,
    venueConfigs.findIndex((vc) => vc.id === venueConfig.id),
  );
  const belongsToLayout = (cfgId?: string) =>
    cfgId && cfgId !== "default"
      ? cfgId === venueConfig.id
      : layoutIndex === 0;

  // Tables may be stored as a flat array (tagged with venueConfigId) OR as a
  // Record keyed by layout id — the eventfront reads venueTables[layoutId], so
  // do the same here, otherwise every hall's spaces get flattened together.
  const tablesRaw: any = event.venueTables;
  const tables: PositionedTable[] = Array.isArray(tablesRaw)
    ? tablesRaw.filter((t: any) => belongsToLayout(t?.venueConfigId))
    : (tablesRaw?.[venueConfig.id] as PositionedTable[] | undefined) ||
      // Legacy single-venue data may key the first hall under "default".
      (layoutIndex === 0
        ? (tablesRaw?.["default"] as PositionedTable[] | undefined)
        : undefined) ||
      [];

  // Round tables / speaker zones / doors are flat arrays tagged with
  // venueConfigId — filter each to the selected hall.
  const rounds = flatten<PositionedRoundTable>(event.venueRoundTables).filter(
    (r) => belongsToLayout((r as any)?.venueConfigId),
  );
  const zones = flatten<PositionedSpeakerZone>(event.venueSpeakerZones).filter(
    (z) => belongsToLayout((z as any)?.venueConfigId),
  );
  const doors = flatten<PositionedDoor>(event.venueDoors).filter((d) =>
    belongsToLayout((d as any)?.venueConfigId),
  );

  // Canvas size — matches the eventfront's computeCanvasExtents EXACTLY so the
  // map is proportioned the same:
  //  • If the organizer cropped the venue, show precisely the crop box (items
  //    outside it are filtered out by SpaceLayout). This is why eventfront
  //    spaces look bigger — the cropped area scales up to fill the width.
  //  • Otherwise grow the canvas to cover every placed item (+ padding), with a
  //    baseline of the configured venue size, capped so a stray far-flung item
  //    can't blow the canvas into endless empty space.
  const PADDING = 80;
  const cfgAny = venueConfig as any;
  const baseW = venueConfig.width || 800;
  const baseH = venueConfig.height || 500;
  const cropped = !!cfgAny.cropped;
  let canvasW: number;
  let canvasH: number;
  if (cropped) {
    canvasW = Number(cfgAny.cropWidth) || baseW;
    canvasH = Number(cfgAny.cropHeight) || baseH;
  } else {
    const limitX = Math.max(baseW * 5, 6000);
    const limitY = Math.max(baseH * 5, 6000);
    let maxX = baseW;
    let maxY = baseH;
    const addX = (v: number) => {
      if (v <= limitX) maxX = Math.max(maxX, v);
    };
    const addY = (v: number) => {
      if (v <= limitY) maxY = Math.max(maxY, v);
    };
    for (const t of tables) {
      const w = (t as any).displayWidth ?? t.width ?? 0;
      const h = (t as any).displayHeight ?? t.height ?? 0;
      addX((t.x || 0) + w);
      addY((t.y || 0) + h);
    }
    for (const r of rounds) {
      const d = r.tableDiameter || 120;
      addX((r.x || 0) + d);
      addY((r.y || 0) + d);
    }
    for (const z of zones) {
      addX((z.x || 0) + (z.width || 0));
      addY((z.y || 0) + (z.height || 0));
    }
    for (const d of doors) {
      const dw = Number(d.width) > 0 ? Number(d.width) : 50;
      const dh = Number(d.height) > 0 ? Number(d.height) : 50;
      addX((d.x || 0) + dw);
      addY((d.y || 0) + dh);
    }
    canvasW = maxX + PADDING;
    canvasH = maxY + PADDING;
  }
  extentsRef.current = { width: canvasW, height: canvasH };

  // Config handed to SpaceLayout — the canvas dimensions are the computed
  // extents / crop box (NOT the raw venue width/height) so the grid + bounds
  // match the rendered spaces, and items outside a crop are clipped away.
  const canvasConfig = {
    width: canvasW,
    height: canvasH,
    gridSize: venueConfig.gridSize,
    showGrid: venueConfig.showGrid,
    hasMainStage: venueConfig.hasMainStage,
    cropped,
    cropWidth: canvasW,
    cropHeight: canvasH,
  };

  return (
    <div className="space-y-4">
      {/* Venue selector — one tab per venue (only shown for multi-venue
          events). Selecting a venue shows ONLY that venue's layout. */}
      {venueConfigs.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Select venue
          </div>
          <div className="flex gap-1 flex-wrap rounded-lg bg-slate-100 p-1 w-fit">
            {venueConfigs.map((vc, i) => (
              <button
                key={vc.id}
                type="button"
                onClick={() => setSelectedConfigId(vc.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  vc.id === venueConfig.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white/70"
                }`}
              >
                {vc.name || `Venue ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-md border bg-slate-50 px-3 py-2 text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
        <span className="font-semibold uppercase tracking-wide">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-pink-400/80 border border-pink-600 rounded-sm" />
          Available space
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm border"
            style={{ backgroundColor: "#374151", borderColor: "#1f2937" }}
          />
          Booked
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

      {/* Canvas — fit-to-width, same approach as the public eventfront map.
          The inner board renders at natural size and is CSS-scaled down so the
          spacing/proportions match the eventfront exactly. */}
      <div
        ref={venueScrollRef}
        className="relative border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 overflow-auto p-4"
      >
        <div
          className="mx-auto"
          style={{ width: canvasW * fitScale, height: canvasH * fitScale }}
        >
          <div
            style={{
              width: canvasW,
              height: canvasH,
              transform: `scale(${fitScale})`,
              transformOrigin: "top left",
            }}
          >
        <SpaceLayout
          config={canvasConfig}
          crop={cropped}
          scale={1}
          tables={tables}
          roundTables={rounds}
          doors={doors}
          speakerZones={zones}
          // Tapping a booked space opens the quick card (the hover card is
          // desktop-only — no hover on touch). Its "View details" button then
          // opens the full dialog, mirroring the desktop two-step flow.
          onSpaceClick={(t: any) => {
            const booking = bookings[t.positionId];
            if (booking) setQuickCard({ t, booking });
          }}
          getState={(t: any) => {
            // Booked spaces are painted DARK GREY so a volunteer can tell at a
            // glance which stalls are taken (and click them for details); free
            // spaces keep their template colour. booked:false keeps the space
            // clickable — the dark fill comes from the explicit `fill` override
            // rather than SpaceLayout's non-interactive grey. Cancelled/deleted
            // bookings are already dropped from `bookings`, so they read free.
            const booking = bookings[t.positionId];
            return {
              booked: false,
              ...(booking
                ? { fill: "#374151", border: "#1f2937" } // slate-700 / slate-800
                : {}),
              title: booking
                ? `${t.tableName || t.name || "Stall"} — ${booking.vendorName}`
                : t.tableName || t.name || "Available",
            };
          }}
          renderSpaceLabel={(t: any) => {
            // Show the SPACE NAME on the tile (same as the eventfront map);
            // vendor + add-on details live in the hover card. Booked stalls keep
            // their purchased add-on colour dots along the bottom edge.
            const booking = bookings[t.positionId];
            const stallLabel = t.tableName || t.name || "";
            const dots = (booking?.addOns || []).map((a: any) => ({
              color: addOnColorMap.get(a.id)?.color || "#6b7280",
            }));
            return (
              <>
                <span
                  className="truncate w-full text-center"
                  style={{
                    // White on the dark-grey booked fill; dark on free spaces.
                    color: booking ? "#f9fafb" : "#111827",
                    fontWeight: 800,
                    fontSize: 8,
                    lineHeight: 1,
                    padding: 1,
                  }}
                >
                  {stallLabel}
                </span>
                {dots.length > 0 && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 flex gap-0.5"
                    style={{ bottom: 2 }}
                  >
                    {dots.slice(0, 8).map((d: any, i: number) => (
                      <span
                        key={i}
                        className="rounded-full border border-white/80 shadow"
                        style={{ width: 6, height: 6, backgroundColor: d.color }}
                      />
                    ))}
                    {dots.length > 8 && (
                      <span className="text-[7px] font-bold text-slate-600 ml-0.5">
                        +{dots.length - 8}
                      </span>
                    )}
                  </div>
                )}
              </>
            );
          }}
          wrapSpace={(t: any, node: any) => {
            const booking = bookings[t.positionId];
            if (!booking) return node;
            return (
              <HoverCard openDelay={120}>
                <HoverCardTrigger asChild>{node}</HoverCardTrigger>
                <HoverCardContent side="top" align="center" className="w-80 p-3">
                  {renderQuickCard(t, booking, () =>
                    openStallDetails(t.positionId),
                  )}
                </HoverCardContent>
              </HoverCard>
            );
          }}
        />
          </div>
        </div>
      </div>

      {/* Mobile quick card — shown on tap (no hover on touch). Same content as
          the desktop hover card; its "View details" opens the full dialog. */}
      <Dialog
        open={!!quickCard}
        onOpenChange={(o) => {
          if (!o) setQuickCard(null);
        }}
      >
        <DialogContent className="max-w-sm p-4">
          {quickCard &&
            renderQuickCard(quickCard.t, quickCard.booking, () => {
              const pos = quickCard.t.positionId;
              setQuickCard(null);
              openStallDetails(pos);
            })}
        </DialogContent>
      </Dialog>

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

