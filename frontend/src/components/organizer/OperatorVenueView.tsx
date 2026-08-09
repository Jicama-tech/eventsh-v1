import { useEffect, useRef, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Info, Download, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ExhibitorDetailDialog } from "./ExhibitorDetailDialog";
import SpaceLayout from "./SpaceLayout";
import type { StallRequest } from "./shopKeeper";

/** Resolve an event image field to an absolute URL — mirrors the pattern
 * used for the event card thumbnail (relative paths are served off the API
 * origin, not `/api`). */
function resolveImageUrl(image: string): string {
  return image.startsWith("/")
    ? `${apiURL?.replace("/api", "")}${image}`
    : image;
}

/** Best-effort fetch of a remote image as a data URL for embedding in the
 * exported PDF. Fails silently (caller falls back to a text-only header) —
 * a private bucket or CORS-blocked host shouldn't break the whole export. */
async function imageToDataUrl(
  url: string,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" }> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("image fetch failed");
  const blob = await res.blob();
  const format = blob.type.includes("png")
    ? "PNG"
    : blob.type.includes("webp")
      ? "WEBP"
      : "JPEG";
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { dataUrl, format };
}

/** Shortens `text` with a trailing "…" until it fits within `maxW` points at
 * the PDF's current font — used to keep directory-table cells from
 * overflowing into their neighbour instead of wrapping (which would break
 * the table's fixed row height). */
function fitText(pdf: any, text: string, maxW: number): string {
  if (!text) return "";
  if (pdf.getTextWidth(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && pdf.getTextWidth(s + "…") > maxW) {
    s = s.slice(0, -1);
  }
  return s.length < text.length ? s + "…" : s;
}

// Shared canvas 2D context for text-width measurement, built once. Real
// measureText (not a char-count heuristic) so the fitted lines are the
// lines that actually render — an estimate was letting some tiles compute
// too few lines, so the "…" (a CSS -webkit-line-clamp, which html2canvas
// doesn't support/render at all) never fired and the excess just got
// hard-clipped mid-glyph by the tile's overflow:hidden instead.
let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, fontPx: number): number {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return text.length * fontPx * 0.6; // no canvas — rough fallback
  measureCtx.font = `800 ${fontPx}px sans-serif`;
  return measureCtx.measureText(text).width;
}

/** Greedy word-wrap: splits `text` into lines that each fit within `maxW` px
 * at `fontPx`. Hard-breaks a single word that's wider than the box on its
 * own (long brand names with no spaces). */
function wrapWords(text: string, fontPx: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const pushHardBroken = (w: string) => {
    let rest = w;
    while (textWidth(rest, fontPx) > maxW && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && textWidth(rest.slice(0, cut), fontPx) > maxW) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    return rest;
  };
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (!line || textWidth(candidate, fontPx) <= maxW) {
      line = candidate;
    } else {
      lines.push(line);
      line = textWidth(w, fontPx) > maxW ? pushHardBroken(w) : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Picks the largest font size (within [min,max]) at which `text` wraps to
 * fit entirely inside a `boxW`×`boxH` tile; falls back to `min` with the
 * text clipped to however many lines actually fit, ellipsising the last
 * visible line — so overflow is always a clean "…", never a hard glyph
 * clip. Vendor/brand names run far longer than the short stall codes these
 * tiles were sized for, so a fixed single-line label just cut most of them
 * off. */
function fitLabel(
  text: string,
  boxW: number,
  boxH: number,
  max = 8,
  min = 4.5,
): { lines: string[]; fontSize: number } {
  const usableW = Math.max(4, boxW - 4);
  if (!text) return { lines: [], fontSize: max };
  for (let fs = max; fs >= min; fs -= 0.5) {
    const lineH = fs * 1.15;
    const maxLines = Math.max(1, Math.floor(boxH / lineH));
    const lines = wrapWords(text, fs, usableW);
    if (lines.length <= maxLines) return { lines, fontSize: fs };
  }
  const lineH = min * 1.15;
  const maxLines = Math.max(1, Math.floor(boxH / lineH));
  const lines = wrapWords(text, min, usableW).slice(0, maxLines);
  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    let s = last;
    while (s.length > 1 && textWidth(s + "…", min) > usableW) s = s.slice(0, -1);
    lines[maxLines - 1] = s.length < last.length ? s + "…" : s;
  }
  return { lines, fontSize: min };
}

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
  // Which paper size is currently being generated, so the trigger button can
  // show a spinner + the two menu items can disable themselves mid-export.
  const [pdfBusy, setPdfBusy] = useState<"a1" | "a4" | null>(null);
  // Off-screen, natural-resolution copy of the map (see below) — the
  // html2canvas capture source for PDF export.
  const exportRef = useRef<HTMLDivElement>(null);

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

  // Every space keeps its own template colour whether it's booked or free —
  // booked/free reads from the LABEL (vendor/brand name vs. the space's own
  // name), not from a colour override. booked:false keeps the space
  // clickable; SpaceLayout falls back to the template's `t.color` whenever
  // getState doesn't hand back an explicit fill/border. Cancelled/deleted
  // bookings are already dropped from `bookings`, so they read free. Shared
  // by the visible canvas AND the hidden export copy below, so the PDF
  // matches what's on screen.
  const getSpaceState = (t: any) => {
    const booking = bookings[t.positionId];
    return {
      booked: false,
      title: booking
        ? `${t.tableName || t.name || "Stall"} — ${booking.vendorName}`
        : t.tableName || t.name || "Available",
    };
  };

  // Booked stalls show the VENDOR/BRAND name on the tile so the map reads as
  // "who's where"; unbooked spaces fall back to the space's own name (there's
  // no vendor to show yet). Add-on details live in the hover card; booked
  // stalls keep their purchased add-on colour dots along the bottom edge.
  const renderSpaceLabelFn = (t: any) => {
    const booking = bookings[t.positionId];
    const stallLabel = booking
      ? booking.businessName || booking.vendorName
      : t.tableName || t.name || "";
    const dots = (booking?.addOns || []).map((a: any) => ({
      color: addOnColorMap.get(a.id)?.color || "#6b7280",
    }));
    // Vendor/brand names run far longer than the short codes these tiles
    // were sized for — `truncate` cut most of them off after a few
    // characters. Shrink the font and wrap across real, explicitly-measured
    // lines instead (a CSS -webkit-line-clamp was tried here first, but
    // html2canvas doesn't render that property — the PDF export just
    // hard-clipped mid-glyph instead of showing the intended "…").
    const boxW = (t.displayWidth ?? t.width ?? 50) as number;
    const boxH = (t.displayHeight ?? t.height ?? 50) as number;
    const { lines, fontSize } = fitLabel(stallLabel, boxW, boxH);
    return (
      <>
        <div
          className="w-full text-center"
          style={{
            color: "#111827",
            fontWeight: 800,
            fontSize,
            lineHeight: 1.15,
            padding: 1,
            overflow: "hidden",
          }}
        >
          {lines.map((ln, i) => (
            <div key={i}>{ln}</div>
          ))}
        </div>
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
  };

  // Add-on dots only, no text — used for the hidden EXPORT copy that
  // html2canvas rasterises for the PDF. html2canvas measures/positions text
  // incorrectly on tiles that are both rotated (rotate + SpaceLayout's own
  // counter-rotate to keep the label upright) AND carry a long vendor/brand
  // name — it clips or mis-centres the text even though the same DOM renders
  // perfectly on screen (confirmed: it's an html2canvas layout bug, not a
  // real one — a plain screenshot of the live tile is clean). Rather than
  // fight that, the export map carries no text at all; downloadVenuePdf
  // draws every label itself with jsPDF's native text after the map image is
  // placed, which is exact regardless of rotation and prints crisper too.
  const renderDotsOnlyFn = (t: any) => {
    const booking = bookings[t.positionId];
    const dots = (booking?.addOns || []).map((a: any) => ({
      color: addOnColorMap.get(a.id)?.color || "#6b7280",
    }));
    if (dots.length === 0) return null;
    return (
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
    );
  };

  // Rasterise the off-screen natural-resolution map, then compose it into a
  // print-ready PDF: a title band (event name/venue/date, best-effort logo),
  // the legend, the map itself, and — for A4 — an exhibitor directory table
  // on the page(s) that follow (A4 is too small to read stall labels once
  // printed, so the directory backs the map up).
  const downloadVenuePdf = async (paperSize: "a1" | "a4") => {
    if (!exportRef.current) return;
    setPdfBusy(paperSize);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] =
        await Promise.all([import("html2canvas"), import("jspdf")]);

      // Higher raster scale for A1 so it stays crisp blown up to poster size.
      const mapCanvas = await html2canvas(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: paperSize === "a1" ? 2.5 : 2,
        useCORS: true,
      });
      const mapImg = mapCanvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: paperSize,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = paperSize === "a1" ? 40 : 24;
      const big = paperSize === "a1";

      // --- Title band ------------------------------------------------
      const headerH = big ? 100 : 60;
      pdf.setFillColor(30, 41, 59); // slate-800
      pdf.rect(0, 0, pageW, headerH, "F");

      let textX = margin;
      if (event.image) {
        try {
          const { dataUrl, format } = await imageToDataUrl(
            resolveImageUrl(event.image),
          );
          const logoSize = headerH - 24;
          pdf.addImage(dataUrl, format, margin, 12, logoSize, logoSize);
          textX = margin + logoSize + 16;
        } catch {
          // No usable image (CORS-blocked, missing, etc.) — text-only header.
        }
      }

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(big ? 24 : 15);
      pdf.text(event.title || "Event", textX, headerH / 2 - (big ? 10 : 4));

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(big ? 12 : 8.5);
      const venueLine = [event.location, event.address]
        .filter(Boolean)
        .join(" — ");
      const dateLine = [
        event.startDate
          ? new Date(event.startDate).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "",
        event.time,
      ]
        .filter(Boolean)
        .join(" · ");
      if (venueLine) pdf.text(venueLine, textX, headerH / 2 + (big ? 12 : 9));
      if (dateLine) pdf.text(dateLine, textX, headerH / 2 + (big ? 28 : 20));
      pdf.setFontSize(big ? 12 : 8.5);
      pdf.text(venueConfig.name || "Venue", pageW - margin, headerH / 2, {
        align: "right",
      });
      pdf.setTextColor(0, 0, 0);

      // --- Map -----------------------------------------------------------
      const y = headerH + margin;
      const mapMaxW = pageW - margin * 2;
      const mapMaxH = pageH - y - margin;
      const ratio = Math.min(
        mapMaxW / mapCanvas.width,
        mapMaxH / mapCanvas.height,
      );
      const drawW = mapCanvas.width * ratio;
      const drawH = mapCanvas.height * ratio;
      const mapX = (pageW - drawW) / 2;
      pdf.setDrawColor(210);
      pdf.rect(mapX - 2, y - 2, drawW + 4, drawH + 4);
      pdf.addImage(mapImg, "PNG", mapX, y, drawW, drawH);

      // --- Space labels, drawn natively (not part of the rasterised map) ---
      // The export copy carries no text (see renderDotsOnlyFn) — html2canvas
      // mis-measures/mis-centres text on tiles that are both rotated and
      // long-labelled, clipping it, even though the exact same DOM is clean
      // on screen. Drawing the labels here with jsPDF's own text is exact
      // regardless of rotation, and prints crisper (real text, not pixels).
      const scaleToPdf = drawW / canvasW;
      pdf.setFont("helvetica", "bold");
      for (const t of tables) {
        const bx = (t as any).x ?? 0;
        const by = (t as any).y ?? 0;
        // Off-canvas items (outside a crop) aren't drawn on the map either.
        if (bx < 0 || by < 0 || bx > canvasW || by > canvasH) continue;
        const booking = bookings[t.positionId];
        const label = booking
          ? booking.businessName || booking.vendorName
          : t.tableName || t.name || "";
        if (!label) continue;
        const bw = ((t as any).displayWidth ?? t.width ?? 50) as number;
        const bh = ((t as any).displayHeight ?? t.height ?? 50) as number;
        const cx = mapX + (bx + bw / 2) * scaleToPdf;
        const cy = y + (by + bh / 2) * scaleToPdf;
        // The label always renders upright — SpaceLayout counter-rotates it
        // to cancel the tile's own rotation — so the space actually
        // available for that upright text is the tile's VISUAL footprint,
        // which swaps width/height once rotated 90°/270°.
        const rotated90 = Math.abs(((t as any).rotation || 0) % 180) === 90;
        const footW = (rotated90 ? bh : bw) * scaleToPdf;
        const footH = (rotated90 ? bw : bh) * scaleToPdf;
        const fs = Math.max(3.5, Math.min(7, footH * 0.4));
        pdf.setFontSize(fs);
        pdf.setTextColor(17, 24, 39);
        const fitted = fitText(pdf, label, Math.max(6, footW - 3));
        pdf.text(fitted, cx, cy + fs * 0.32, { align: "center" });
      }
      pdf.setTextColor(0, 0, 0);

      const stamp = () => {
        pdf.setFontSize(7).setTextColor(150);
        pdf.text(
          `Generated ${new Date().toLocaleDateString()} · EventSH`,
          pageW - margin,
          pageH - 10,
          { align: "right" },
        );
        pdf.setTextColor(0);
      };
      stamp();

      // --- Exhibitor directory (A4 only) — the map alone prints too small
      // to read stall labels at A4, so back it with page(s) listing every
      // booked stall against its exhibitor as an actual bordered table
      // (header row + gridlines), laid out in side-by-side column-blocks —
      // the same shape as a printed participant directory.
      if (paperSize === "a4") {
        const directory = tables
          .filter((t) => bookings[t.positionId])
          .map((t) => {
            const b = bookings[t.positionId];
            const exhibitor = b.businessName || b.vendorName || "—";
            return {
              label: t.tableName || t.name || t.positionId,
              exhibitor,
              // Only show a separate contact line when it's not just a
              // repeat of the exhibitor name already shown.
              contact: b.businessName && b.businessName !== b.vendorName
                ? b.vendorName
                : "",
            };
          })
          .sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { numeric: true }),
          );

        if (directory.length > 0) {
          const rowH = 14;
          const headerH = 16;
          const blockGap = 14;
          const maxBlocks = 3;
          const titleH = 22;
          const topY = margin + titleH;
          const availH = pageH - topY - margin;
          const rowsPerBlock = Math.max(1, Math.floor((availH - headerH) / rowH));
          // Only spread across multiple blocks once there's enough rows to
          // fill them — a handful of exhibitors gets one clean table, not
          // three mostly-empty ones.
          const blocks = Math.max(
            1,
            Math.min(maxBlocks, Math.ceil(directory.length / rowsPerBlock)),
          );
          const totalW = pageW - margin * 2;
          const blockW = (totalW - blockGap * (blocks - 1)) / blocks;
          const numW = Math.max(16, blockW * 0.07);
          const stallW = Math.max(32, blockW * 0.15);
          const contactW = blockW * 0.32;
          const exhibitorW = blockW - numW - stallW - contactW;
          const perPage = rowsPerBlock * blocks;

          for (let start = 0, pageIdx = 0; start < directory.length; start += perPage, pageIdx++) {
            pdf.addPage();
            pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor(0);
            pdf.text(
              pageIdx === 0
                ? "Exhibitor Directory"
                : "Exhibitor Directory (cont'd)",
              margin,
              margin + 12,
            );

            const chunk = directory.slice(start, start + perPage);
            for (let b = 0; b < blocks; b++) {
              const blockEntries = chunk.slice(
                b * rowsPerBlock,
                (b + 1) * rowsPerBlock,
              );
              if (blockEntries.length === 0) continue;
              const bx = margin + b * (blockW + blockGap);
              const totalBlockH = headerH + blockEntries.length * rowH;
              const colXs = [
                bx,
                bx + numW,
                bx + numW + stallW,
                bx + numW + stallW + exhibitorW,
                bx + blockW,
              ];

              pdf.setFillColor(241, 245, 249); // slate-100
              pdf.rect(bx, topY, blockW, headerH, "F");
              pdf.setDrawColor(180);
              pdf.rect(bx, topY, blockW, totalBlockH); // outer border

              pdf.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(51);
              pdf.text("#", colXs[0] + 3, topY + headerH - 5);
              pdf.text("Stall", colXs[1] + 3, topY + headerH - 5);
              pdf.text("Exhibitor", colXs[2] + 3, topY + headerH - 5);
              pdf.text("Contact", colXs[3] + 3, topY + headerH - 5);
              pdf.setTextColor(0);

              pdf.setFont("helvetica", "normal").setFontSize(7.5);
              blockEntries.forEach((d, i) => {
                const ry = topY + headerH + i * rowH;
                const rowNum = start + b * rowsPerBlock + i + 1;
                pdf.text(String(rowNum), colXs[0] + 3, ry + rowH - 4);
                pdf.text(fitText(pdf, d.label, stallW - 6), colXs[1] + 3, ry + rowH - 4);
                pdf.text(
                  fitText(pdf, d.exhibitor, exhibitorW - 6),
                  colXs[2] + 3,
                  ry + rowH - 4,
                );
                if (d.contact) {
                  pdf.text(
                    fitText(pdf, d.contact, contactW - 6),
                    colXs[3] + 3,
                    ry + rowH - 4,
                  );
                }
              });

              pdf.setDrawColor(210);
              for (let r = 0; r <= blockEntries.length; r++) {
                const ly = topY + headerH + r * rowH;
                pdf.line(bx, ly, bx + blockW, ly);
              }
              for (const cx of colXs) pdf.line(cx, topY, cx, topY + totalBlockH);
            }
            stamp();
          }
        }
      }

      const safe = (event.title || venueConfig.name || "venue").replace(
        /[^a-z0-9]+/gi,
        "_",
      );
      pdf.save(`${safe}-venue-layout-${paperSize.toUpperCase()}.pdf`);
      toast({ title: `${paperSize.toUpperCase()} PDF downloaded` });
    } catch (err) {
      console.error("Venue layout PDF export failed:", err);
      toast({ variant: "destructive", title: "PDF export failed" });
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Download — a print-ready PDF of this layout. A1 is a big single
          poster for pinning up on-site; A4 is a compact handout that also
          lists every booked stall against its exhibitor (stall labels are
          too small to read at A4 size once printed). */}
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="buttonOutline" size="sm" disabled={!!pdfBusy}>
              {pdfBusy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Download PDF
              <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!!pdfBusy}
              onClick={() => downloadVenuePdf("a1")}
            >
              A1 — large poster
              <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                for on-site printing
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!!pdfBusy}
              onClick={() => downloadVenuePdf("a4")}
            >
              A4 — handout
              <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                + exhibitor directory
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
          <span className="inline-block w-3 h-3 bg-slate-300 border border-slate-400 rounded-sm" />
          Space colour = its own template
        </span>
        <span className="flex items-center gap-1 font-medium text-slate-700">
          Booked → shows the exhibitor's name on the tile
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
          getState={getSpaceState}
          renderSpaceLabel={renderSpaceLabelFn}
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

      {/* Off-screen, natural-resolution duplicate of the map — the
          html2canvas capture source for "Download PDF". Kept separate from
          the visible canvas above because that one is CSS-scaled down to fit
          the dialog width; capturing it directly would rasterise at whatever
          the on-screen zoom happens to be instead of full resolution. Static
          (no click handlers/hover cards) since it's never actually seen. */}
      <div className="fixed left-[-99999px] top-0" aria-hidden="true">
        <div
          ref={exportRef}
          style={{ width: canvasW, height: canvasH, background: "#ffffff" }}
        >
          <SpaceLayout
            config={canvasConfig}
            crop={cropped}
            scale={1}
            tables={tables}
            roundTables={rounds}
            doors={doors}
            speakerZones={zones}
            getState={getSpaceState}
            renderSpaceLabel={renderDotsOnlyFn}
          />
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

