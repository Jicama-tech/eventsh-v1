import { useEffect, useRef, useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Info, Download, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ExhibitorDetailDialog } from "./ExhibitorDetailDialog";
import SpaceLayout from "./SpaceLayout";
import type { StallRequest } from "./shopKeeper";
import { t } from "@/i18n/t";

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

/** Line-height multiplier used to both wrap and vertically stack the space
 * labels below — kept as one constant so wrapping math and draw-position
 * math never drift apart. */
const LABEL_LINE_HEIGHT = 1.15;

/** Wraps a space's main label onto up to `maxLines` lines instead of
 * ellipsis-truncating it — organizers want the full vendor/brand name
 * readable on the map, not cut off, even if that means shrinking the font.
 * Tries the auto-computed `baseFs` first (mutates the PDF's font size as it
 * goes — caller must re-set it before drawing anything else); if that wraps
 * to more lines than fit `maxHeight` or exceeds `maxLines`, it steps the
 * size down (never below ~55% of baseFs, so it doesn't shrink into
 * illegibility) and re-wraps. If it still doesn't fit at the floor size,
 * the overflow lines are collapsed into the last line with an ellipsis
 * rather than spilling past the box. */
function fitLabelLines(
  pdf: any,
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseFs: number,
  maxLines = 3,
): { lines: string[]; fs: number } {
  const minFs = baseFs * 0.55;
  let fs = baseFs;
  let lines: string[] = [text];
  for (let i = 0; i < 8; i++) {
    pdf.setFontSize(fs);
    lines = pdf.splitTextToSize(text, maxWidth);
    const blockH = lines.length * fs * LABEL_LINE_HEIGHT;
    if (lines.length <= maxLines && blockH <= maxHeight) break;
    if (fs <= minFs) break;
    fs = Math.max(minFs, fs * 0.88);
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const overflow = lines.slice(maxLines - 1).join(" ");
    kept[maxLines - 1] = fitText(pdf, overflow, maxWidth);
    lines = kept;
  }
  return { lines, fs };
}

/** Which field(s) the organizer wants printed on each booked space, chosen
 * in the export-config dialog. Unbooked spaces always show their own name
 * regardless of this — there's no vendor/brand data for an empty stall. The
 * "+" options print two fields joined with an em dash (e.g. "A1 — Acme
 * Traders") rather than picking just one. */
export type ExportLabelField =
  | "spaceName"
  | "vendorName"
  | "brandName"
  | "businessName"
  | "displayName"
  | "spaceName+businessName"
  | "spaceName+brandName"
  | "spaceName+displayName"
  | "vendorName+brandName"
  | "vendorName+businessName"
  | "vendorName+displayName";

/** Joins two label parts with an em dash, dropping whichever side is empty
 * instead of printing a bare "— " or " —". */
function joinLabelParts(a: string, b: string): string {
  return [a, b].filter(Boolean).join(" — ");
}

/** Resolves the label text for one space in the exported PDF (both the map
 * tile and the directory's "Exhibitor" column go through this, so they stay
 * consistent with whichever field the organizer picked) — each single-field
 * option still falls back through the others rather than printing blank
 * when the specifically-chosen field is empty for that vendor. */
function resolveExportLabel(
  t: any,
  booking: BookingInfo | undefined,
  field: ExportLabelField,
): string {
  const spaceName = t.tableName || t.name || t.positionId || "";
  if (!booking) return spaceName;
  switch (field) {
    case "spaceName":
      return spaceName;
    case "vendorName":
      return booking.vendorName || booking.businessName || booking.brandName || spaceName;
    case "businessName":
      return booking.businessName || booking.brandName || booking.vendorName || spaceName;
    case "displayName":
      return (
        booking.displayName ||
        booking.brandName ||
        booking.businessName ||
        booking.vendorName ||
        spaceName
      );
    case "spaceName+businessName":
      return joinLabelParts(
        spaceName,
        booking.businessName || booking.brandName || booking.vendorName || "",
      );
    case "spaceName+brandName":
      return joinLabelParts(
        spaceName,
        booking.brandName || booking.businessName || booking.vendorName || "",
      );
    case "spaceName+displayName":
      return joinLabelParts(
        spaceName,
        booking.displayName || booking.brandName || booking.businessName || "",
      );
    case "vendorName+brandName":
      return joinLabelParts(
        booking.vendorName || spaceName,
        booking.brandName || booking.businessName || "",
      );
    case "vendorName+businessName":
      return joinLabelParts(
        booking.vendorName || spaceName,
        booking.businessName || booking.brandName || "",
      );
    case "vendorName+displayName":
      return joinLabelParts(
        booking.vendorName || spaceName,
        booking.displayName || booking.brandName || booking.businessName || "",
      );
    case "brandName":
    default:
      return booking.brandName || booking.businessName || booking.vendorName || spaceName;
  }
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
  brandName?: string;
  displayName?: string;
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
  // Picking A1/A4 from the dropdown no longer exports immediately — it opens
  // this config dialog first (label field, directory toggle, label size),
  // with the chosen size held here until "Generate PDF" is actually clicked.
  const [exportConfigSize, setExportConfigSize] = useState<"a1" | "a4" | null>(
    null,
  );
  const [exportLabelField, setExportLabelField] =
    useState<ExportLabelField>("brandName");
  const [exportIncludeDirectory, setExportIncludeDirectory] = useState(true);
  // When on, each space's own code/name (e.g. "C1") is printed just outside
  // its box on the map — in addition to whatever exportLabelField shows
  // inside — so the floor plan still reads as a grid reference even when the
  // inside label is a vendor/brand name instead of the space name.
  const [exportShowSpaceNames, setExportShowSpaceNames] = useState(false);
  // Multiplier applied to the auto-computed per-tile label font size (see
  // downloadVenuePdf) — 1 = the existing default sizing, adjustable via the
  // dialog's live preview.
  const [exportLabelScale, setExportLabelScale] = useState(1);
  // Separate multiplier for the outside-the-box space name (see
  // "Show Space Names" above) — kept independent from exportLabelScale so
  // sizing the inside vendor/brand label doesn't force the outside space
  // code to the same size; it's printed smaller by nature (a secondary
  // reference, not the primary label) and organizers asked to tune it on
  // its own.
  const [exportSpaceNameScale, setExportSpaceNameScale] = useState(1);
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
            // Distinct from businessName/shopName — a vendor's registered
            // shop name and their marketed brand name aren't always the
            // same thing. Falls back through the same chain if unset.
            const brandName =
              sk?.brandName || stall?.shopkeeper?.brandName || stall?.brandName;
            // Organizer/operator-only reference label — bound to this stall,
            // never the vendor, so two stalls held by the same exhibitor can
            // carry different display names.
            const displayName = stall?.displayName;
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
                brandName,
                displayName,
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
          <div className="text-xs text-muted-foreground">
            Booked by {booking.vendorName}
          </div>
          {booking.businessName && (
            <div className="text-xs text-muted-foreground">{booking.businessName}</div>
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
            <div className="text-[11px] text-muted-foreground mt-1">
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
                    className="w-3 h-3 rounded-full border border-border shrink-0"
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
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
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
      <div className="text-sm text-muted-foreground italic text-center py-8">
        No venue data found for this event.
      </div>
    );
  }

  const venueConfigs: VenueConfig[] = event.venueConfig || [];
  if (venueConfigs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic text-center py-8">
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
              <span className="text-[7px] font-bold text-muted-foreground ml-0.5">
                +{dots.length - 8}
              </span>
            )}
          </div>
        )}
      </>
    );
  };

  // No label, no dots — used for the hidden EXPORT copy that html2canvas
  // rasterises for the PDF. The PDF's map is meant to be the clean printable
  // floor plan; add-on dots are a screen-only aid for volunteers matching
  // vendor purchases at the door (still shown in the live Analytics Venue
  // Layout view via renderSpaceLabelFn) and don't belong on the printout.
  // Text is likewise left out here — html2canvas measures/positions text
  // incorrectly on tiles that are both rotated (rotate + SpaceLayout's own
  // counter-rotate to keep the label upright) AND carry a long vendor/brand
  // name — it clips or mis-centres the text even though the same DOM renders
  // perfectly on screen (confirmed: it's an html2canvas layout bug, not a
  // real one — a plain screenshot of the live tile is clean). downloadVenuePdf
  // draws every label itself with jsPDF's native text after the map image is
  // placed instead, which is exact regardless of rotation and prints
  // crisper too.
  const renderNothingFn = () => null;

  // Rasterise the off-screen natural-resolution map, then compose it into a
  // print-ready PDF: a title band (event name/venue/date, best-effort logo),
  // the map itself with natively-drawn labels (no add-on dots — those are a
  // screen-only aid), and — for A4 — an exhibitor directory table on the
  // page(s) that follow (A4 prints stall labels too small to read on their
  // own, so the directory backs the map up).
  const downloadVenuePdf = async (
    paperSize: "a1" | "a4",
    options: {
      labelField: ExportLabelField;
      includeDirectory: boolean;
      labelScale: number;
      showSpaceNames: boolean;
      spaceNameScale: number;
    },
  ) => {
    if (!exportRef.current) return;
    setPdfBusy(paperSize);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] =
        await Promise.all([import("html2canvas"), import("jspdf")]);

      // --- Content bounding box (export-only auto-crop) -------------------
      // canvasW/canvasH cover the whole configured venue, which is very
      // often much bigger than where stalls actually sit — printing that
      // 1:1 wastes most of the sheet on blank grid down one side. An
      // EXPLICIT manual crop (cropped === true AND real cropWidth/Height on
      // file) is the organizer's deliberate choice — may intentionally
      // include aisle/buffer space — so it's left alone. But `cropped` can
      // be true with no crop size ever saved (canvasW/H above then just
      // fall back to the base venue size same as "uncropped" would) — that's
      // not a real crop, so it still gets auto-cropped to a padded box
      // around the actual tables/round tables/zones/doors.
      const hasExplicitCrop =
        cropped &&
        Number(cfgAny.cropWidth) > 0 &&
        Number(cfgAny.cropHeight) > 0;
      // Small on purpose: a generous pad silently reclaims nothing on any
      // edge where the real slack is smaller than the pad itself (it just
      // clamps back to the untrimmed edge) — this stays well under typical
      // stall spacing so it actually trims the blank margin instead of
      // re-donating it back.
      const CROP_PAD = 20;
      let cropMinX = 0;
      let cropMinY = 0;
      let cropMaxX = canvasW;
      let cropMaxY = canvasH;
      if (!hasExplicitCrop) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const mark = (x: number, y: number, w: number, h: number) => {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x + w);
          maxY = Math.max(maxY, y + h);
        };
        for (const t of tables) {
          const w = (t as any).displayWidth ?? t.width ?? 0;
          const h = (t as any).displayHeight ?? t.height ?? 0;
          mark(t.x || 0, t.y || 0, w, h);
        }
        for (const r of rounds) {
          const d = r.tableDiameter || 120;
          mark(r.x || 0, r.y || 0, d, d);
        }
        for (const z of zones) {
          mark(z.x || 0, z.y || 0, z.width || 0, z.height || 0);
        }
        for (const d of doors) {
          const dw = Number(d.width) > 0 ? Number(d.width) : 50;
          const dh = Number(d.height) > 0 ? Number(d.height) : 50;
          mark(d.x || 0, d.y || 0, dw, dh);
        }
        if (minX !== Infinity) {
          cropMinX = Math.max(0, minX - CROP_PAD);
          cropMinY = Math.max(0, minY - CROP_PAD);
          cropMaxX = Math.min(canvasW, maxX + CROP_PAD);
          cropMaxY = Math.min(canvasH, maxY + CROP_PAD);
        }
      }
      const cropW = cropMaxX - cropMinX;
      const cropH = cropMaxY - cropMinY;

      // Higher raster scale for A1 so it stays crisp blown up to poster size.
      const fullCanvas = await html2canvas(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: paperSize === "a1" ? 2.5 : 2,
        useCORS: true,
      });
      // Crop the raster to the content box above — a no-op when the venue
      // was manually cropped already or has nothing to bound.
      let mapCanvas: HTMLCanvasElement = fullCanvas;
      if (cropW < canvasW || cropH < canvasH) {
        const rasterScale = fullCanvas.width / canvasW;
        const sx = cropMinX * rasterScale;
        const sy = cropMinY * rasterScale;
        const sw = cropW * rasterScale;
        const sh = cropH * rasterScale;
        const off = document.createElement("canvas");
        off.width = sw;
        off.height = sh;
        const ctx = off.getContext("2d");
        if (ctx) {
          ctx.drawImage(fullCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          mapCanvas = off;
        }
      }
      const mapImg = mapCanvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: paperSize,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = paperSize === "a1" ? 40 : 24;
      // The map itself gets a much tighter margin than the header text does
      // — A1 is printed as a poster to be read from a distance, so every bit
      // of sheet not spent on the title band should go to the map growing
      // bigger (and its space labels with it), not to blank paper framing
      // it. A4 keeps the roomier margin; it's a handout, not a poster.
      const mapMargin = paperSize === "a1" ? 12 : 24;
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
      const y = headerH + mapMargin;
      const mapMaxW = pageW - mapMargin * 2;
      const mapMaxH = pageH - y - mapMargin;
      const ratio = Math.min(
        mapMaxW / mapCanvas.width,
        mapMaxH / mapCanvas.height,
      );
      const drawW = mapCanvas.width * ratio;
      const drawH = mapCanvas.height * ratio;
      const mapX = (pageW - drawW) / 2;
      // The map's aspect ratio rarely matches the sheet's exactly, so one
      // axis is always the binding constraint and the other has leftover
      // room — centering on BOTH axes (not just horizontally) spreads that
      // leftover evenly around the map instead of dumping it all as a dead
      // band on one side.
      const mapY = y + (mapMaxH - drawH) / 2;
      pdf.setDrawColor(210);
      pdf.rect(mapX - 2, mapY - 2, drawW + 4, drawH + 4);
      pdf.addImage(mapImg, "PNG", mapX, mapY, drawW, drawH);

      // --- Space labels, drawn natively (not part of the rasterised map) ---
      // The export copy carries no text or dots (see renderNothingFn) —
      // html2canvas mis-measures/mis-centres text on tiles that are both
      // rotated and long-labelled, clipping it, even though the exact same
      // DOM is clean on screen. Drawing the labels here with jsPDF's own
      // text is exact regardless of rotation, and prints crisper (real
      // text, not pixels).
      // drawW maps to cropW (the auto-cropped content box), not the full
      // canvasW — see the crop computed above the html2canvas call.
      const scaleToPdf = drawW / cropW;
      pdf.setFont("helvetica", "bold");
      for (const t of tables) {
        const bx = (t as any).x ?? 0;
        const by = (t as any).y ?? 0;
        // Off-canvas items (outside a crop) aren't drawn on the map either.
        if (bx < 0 || by < 0 || bx > canvasW || by > canvasH) continue;
        const booking = bookings[t.positionId];
        const label = resolveExportLabel(t, booking, options.labelField);
        if (!label) continue;
        const bw = ((t as any).displayWidth ?? t.width ?? 50) as number;
        const bh = ((t as any).displayHeight ?? t.height ?? 50) as number;
        const cx = mapX + (bx - cropMinX + bw / 2) * scaleToPdf;
        const cy = mapY + (by - cropMinY + bh / 2) * scaleToPdf;
        // The label always renders upright — SpaceLayout counter-rotates it
        // to cancel the tile's own rotation — so the space actually
        // available for that upright text is the tile's VISUAL footprint,
        // which swaps width/height once rotated 90°/270°.
        const rotated90 = Math.abs(((t as any).rotation || 0) % 180) === 90;
        const footW = (rotated90 ? bh : bw) * scaleToPdf;
        const footH = (rotated90 ? bw : bh) * scaleToPdf;
        // A4 stalls print much smaller than A1's — the same font-size range
        // read as oversized/cramped on the handout, so it gets its own,
        // smaller ceiling rather than just inheriting A1's.
        const fs =
          (big
            ? Math.max(3.5, Math.min(7, footH * 0.4))
            : Math.max(2.2, Math.min(3.5, footH * 0.22))) * options.labelScale;
        // Wraps onto up to 3 lines (shrinking the font a bit first if
        // needed) instead of ellipsis-truncating — the full name should
        // stay readable on the map rather than getting cut off.
        const { lines: labelLines, fs: labelFs } = fitLabelLines(
          pdf,
          label,
          Math.max(6, footW - 3),
          footH - 2,
          fs,
        );
        pdf.setFontSize(labelFs);
        pdf.setTextColor(17, 24, 39);
        const lineH = labelFs * LABEL_LINE_HEIGHT;
        const blockH = labelLines.length * lineH;
        // First line's baseline: centred as a block around cy, then offset
        // down by the font's ascent (~0.78× size) so it lands the same way
        // the old single-line "cy + fs * 0.32" placement did.
        const firstBaselineY = cy - blockH / 2 + lineH * 0.78;
        labelLines.forEach((ln, i) => {
          pdf.text(ln, cx, firstBaselineY + i * lineH, { align: "center" });
        });

        // "Show Space Names" — the space's own code (e.g. "C1"), printed
        // just outside the box (not inside it) so it reads as a grid
        // reference alongside whichever vendor/brand label is shown inside
        // (skipped when that label already IS the space name — e.g. an
        // unbooked stall — to avoid printing it twice).
        // Which side it prints on is ADAPTIVE, not fixed: a space sitting in
        // the bottom half of the printed map gets its label ABOVE the box
        // instead of below, and a space in the top half gets it below —
        // each pushed toward the page's centre rather than toward the edge
        // it's already closest to, so it never prints at (or past) the
        // sheet's boundary.
        // Own size formula (not just fs reused) — it's a secondary/reference
        // label so it gets its own ceiling, PLUS its own user-adjustable
        // scale (options.spaceNameScale, independent of the main label's
        // options.labelScale) since organizers want to size the two
        // separately, not in lockstep.
        if (options.showSpaceNames) {
          const spaceName = t.tableName || t.name || t.positionId || "";
          if (spaceName && spaceName !== label) {
            const spaceNameFs =
              (big
                ? Math.max(4, Math.min(9, footH * 0.5))
                : Math.max(2.5, Math.min(4, footH * 0.28))) *
              options.spaceNameScale;
            pdf.setFontSize(spaceNameFs);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(71, 85, 105); // slate-600 — distinct from the main label
            const fittedSpaceName = fitText(
              pdf,
              spaceName,
              Math.max(6, footW - 3),
            );
            // Box's vertical centre within the printed (cropped) area —
            // below the midline means "bottom half of the venue".
            const localCenterY = by - cropMinY + bh / 2;
            const inBottomHalf = localCenterY > cropH / 2;
            const labelY = inBottomHalf
              ? cy - footH / 2 - spaceNameFs * 0.25 - 0.5 // above the box
              : cy + footH / 2 + spaceNameFs * 0.75 + 0.5; // below the box
            pdf.text(fittedSpaceName, cx, labelY, { align: "center" });
            pdf.setTextColor(17, 24, 39);
          }
        }
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

      // --- Exhibitor directory (both sizes, toggleable) — the map alone
      // prints stall labels too small to read on their own, so when
      // enabled every size gets page(s) after the map listing each booked
      // stall against its exhibitor as an actual bordered table (header
      // row + gridlines), laid out in side-by-side column-blocks — the
      // same shape as a printed participant directory. A1's poster scale
      // means bigger blocks, a bigger font, and room for more of them
      // across the wider page.
      if (options.includeDirectory) {
        const directory = tables
          .filter((t) => bookings[t.positionId])
          .map((t) => {
            const b = bookings[t.positionId];
            const exhibitor = resolveExportLabel(t, b, options.labelField) || "—";
            return {
              label: t.tableName || t.name || t.positionId,
              exhibitor,
              // Only show a separate contact line when it's not just a
              // repeat of the exhibitor name already shown.
              contact:
                b.vendorName && b.vendorName !== exhibitor ? b.vendorName : "",
            };
          })
          .sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { numeric: true }),
          );

        if (directory.length > 0) {
          const rowH = big ? 24 : 14;
          const headerH = big ? 28 : 16;
          const blockGap = big ? 24 : 14;
          const maxBlocks = big ? 5 : 3;
          const titleH = big ? 34 : 22;
          const cellFontSize = big ? 11 : 7.5;
          const cellPad = big ? 6 : 3;
          const baselineOffset = big ? 8 : 4;
          const topY = margin + titleH;
          const availH = pageH - topY - margin;
          const rowsPerBlock = Math.max(1, Math.floor((availH - headerH) / rowH));
          // Only spread across multiple blocks once there's enough rows to
          // fill them — a handful of exhibitors gets one clean table, not
          // several mostly-empty ones.
          const blocks = Math.max(
            1,
            Math.min(maxBlocks, Math.ceil(directory.length / rowsPerBlock)),
          );
          const totalW = pageW - margin * 2;
          const blockW = (totalW - blockGap * (blocks - 1)) / blocks;
          const numW = Math.max(big ? 26 : 16, blockW * 0.07);
          const stallW = Math.max(big ? 50 : 32, blockW * 0.15);
          const contactW = blockW * 0.32;
          const exhibitorW = blockW - numW - stallW - contactW;
          const perPage = rowsPerBlock * blocks;

          for (let start = 0, pageIdx = 0; start < directory.length; start += perPage, pageIdx++) {
            pdf.addPage();
            pdf
              .setFont("helvetica", "bold")
              .setFontSize(big ? 20 : 12)
              .setTextColor(0);
            pdf.text(
              pageIdx === 0
                ? "Exhibitor Directory"
                : "Exhibitor Directory (cont'd)",
              margin,
              margin + (big ? 20 : 12),
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

              pdf
                .setFont("helvetica", "bold")
                .setFontSize(cellFontSize)
                .setTextColor(51);
              const headerY = topY + headerH - baselineOffset;
              pdf.text("#", colXs[0] + cellPad, headerY);
              pdf.text("Stall", colXs[1] + cellPad, headerY);
              pdf.text("Exhibitor", colXs[2] + cellPad, headerY);
              pdf.text("Contact", colXs[3] + cellPad, headerY);
              pdf.setTextColor(0);

              pdf.setFont("helvetica", "normal").setFontSize(cellFontSize);
              blockEntries.forEach((d, i) => {
                const ry = topY + headerH + i * rowH;
                const rowNum = start + b * rowsPerBlock + i + 1;
                const rowY = ry + rowH - baselineOffset;
                pdf.text(String(rowNum), colXs[0] + cellPad, rowY);
                pdf.text(
                  fitText(pdf, d.label, stallW - cellPad * 2),
                  colXs[1] + cellPad,
                  rowY,
                );
                pdf.text(
                  fitText(pdf, d.exhibitor, exhibitorW - cellPad * 2),
                  colXs[2] + cellPad,
                  rowY,
                );
                if (d.contact) {
                  pdf.text(
                    fitText(pdf, d.contact, contactW - cellPad * 2),
                    colXs[3] + cellPad,
                    rowY,
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
      {/* Download — a print-ready PDF of this layout. Picking a size opens a
          config dialog (label field, exhibitor directory toggle, label
          text size) before generating, rather than exporting immediately. */}
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
              onClick={() => setExportConfigSize("a1")}
            >
              A1 — large poster
              <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                configure…
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!!pdfBusy}
              onClick={() => setExportConfigSize("a4")}
            >
              A4 — handout
              <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                configure…
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Export config — label field, exhibitor directory toggle, and a
          live-sized preview tile so the organizer can see roughly how the
          label text will read before spending time on a full export. */}
      <Dialog
        open={!!exportConfigSize}
        onOpenChange={(open) => !open && setExportConfigSize(null)}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Export {exportConfigSize?.toUpperCase()} —{" "}
              {exportConfigSize === "a1" ? "large poster" : "handout"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Label spaces with")}</Label>
              <Select
                value={exportLabelField}
                onValueChange={(v) =>
                  setExportLabelField(v as ExportLabelField)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brandName">Brand Name</SelectItem>
                  <SelectItem value="vendorName">Vendor Name</SelectItem>
                  <SelectItem value="businessName">Business Name</SelectItem>
                  <SelectItem value="displayName">Display Name</SelectItem>
                  <SelectItem value="spaceName">Space Name</SelectItem>
                  <SelectItem value="spaceName+businessName">
                    Space Name + Business Name
                  </SelectItem>
                  <SelectItem value="spaceName+brandName">
                    Space Name + Brand Name
                  </SelectItem>
                  <SelectItem value="spaceName+displayName">
                    Space Name + Display Name
                  </SelectItem>
                  <SelectItem value="vendorName+brandName">
                    Vendor Name + Brand Name
                  </SelectItem>
                  <SelectItem value="vendorName+businessName">
                    Vendor Name + Business Name
                  </SelectItem>
                  <SelectItem value="vendorName+displayName">
                    Vendor Name + Display Name
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Unbooked spaces always show their own name — there's
                nothing else to print for an empty stall.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="export-directory-toggle">{t("Include Exhibitor Directory")}</Label>
                <p className="text-xs text-muted-foreground">
                  Adds page(s) listing every booked stall against its
                  exhibitor after the map.
                </p>
              </div>
              <Switch
                id="export-directory-toggle"
                checked={exportIncludeDirectory}
                onCheckedChange={setExportIncludeDirectory}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="export-space-names-toggle">{t("Show Space Names")}</Label>
                <p className="text-xs text-muted-foreground">
                  Prints each space's own code (e.g. "C1") just outside its
                  box on the map, in addition to the label above.
                </p>
              </div>
              <Switch
                id="export-space-names-toggle"
                checked={exportShowSpaceNames}
                onCheckedChange={setExportShowSpaceNames}
              />
            </div>

            {exportShowSpaceNames && (
              <div>
                <div className="flex items-center justify-between">
                  <Label>{t("Space Name Text Size")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(exportSpaceNameScale * 100)}%
                  </span>
                </div>
                <Slider
                  className="mt-2"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={[exportSpaceNameScale]}
                  onValueChange={([v]) => setExportSpaceNameScale(v)}
                />
                {/* Same rough visual proxy as the label-size preview below —
                    not the real PDF font metrics, just a concrete reference
                    for "bigger/smaller" at this specific scale. */}
                <div className="mt-3 rounded-lg border bg-muted p-3 flex items-center justify-center">
                  <span
                    className="font-bold text-muted-foreground"
                    style={{ fontSize: `${9 * exportSpaceNameScale}px` }}
                  >
                    C1
                  </span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <Label>{t("Label Text Size")}</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(exportLabelScale * 100)}%
                </span>
              </div>
              <Slider
                className="mt-2"
                min={0.6}
                max={1.6}
                step={0.1}
                value={[exportLabelScale]}
                onValueChange={([v]) => setExportLabelScale(v)}
              />
              {/* Rough visual proxy only — the real PDF uses jsPDF's own font
                  metrics and per-tile auto-fit, not this CSS box. It's here
                  so "bigger/smaller" has an immediate, concrete reference
                  instead of a bare percentage. */}
              <div className="mt-3 rounded-lg border bg-muted p-4 flex items-center justify-center">
                <div
                  className="rounded-md flex items-center justify-center text-center px-2 py-3 text-white font-bold shadow-sm"
                  style={{
                    backgroundColor: "#3b82f6",
                    width: 160,
                    minHeight: 60,
                    fontSize: `${9 * exportLabelScale}px`,
                  }}
                >
                  {
                    {
                      spaceName: "Stall A1",
                      vendorName: "Demo Vendor Name",
                      businessName: "Demo Business Name",
                      brandName: "Demo Organization Name",
                      displayName: "Demo Display Name",
                      "spaceName+businessName": "Stall A1 — Demo Business Name",
                      "spaceName+brandName": "Stall A1 — Demo Organization Name",
                      "spaceName+displayName": "Stall A1 — Demo Display Name",
                      "vendorName+brandName":
                        "Demo Vendor Name — Demo Organization Name",
                      "vendorName+businessName":
                        "Demo Vendor Name — Demo Business Name",
                      "vendorName+displayName":
                        "Demo Vendor Name — Demo Display Name",
                    }[exportLabelField]
                  }
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportConfigSize(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={!!pdfBusy}
              onClick={() => {
                const size = exportConfigSize;
                setExportConfigSize(null);
                if (size) {
                  downloadVenuePdf(size, {
                    labelField: exportLabelField,
                    includeDirectory: exportIncludeDirectory,
                    labelScale: exportLabelScale,
                    showSpaceNames: exportShowSpaceNames,
                    spaceNameScale: exportSpaceNameScale,
                  });
                }
              }}
            >
              {pdfBusy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Venue selector — one tab per venue (only shown for multi-venue
          events). Selecting a venue shows ONLY that venue's layout. */}
      {venueConfigs.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Select venue
          </div>
          <div className="flex gap-1 flex-wrap rounded-lg bg-muted p-1 w-fit">
            {venueConfigs.map((vc, i) => (
              <button
                key={vc.id}
                type="button"
                onClick={() => setSelectedConfigId(vc.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  vc.id === venueConfig.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-white/70"
                }`}
              >
                {vc.name || `Venue ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-md border bg-muted px-3 py-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-3">
        <span className="font-semibold uppercase tracking-wide">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-slate-300 border border-slate-400 rounded-sm" />
          Space colour = its own template
        </span>
        <span className="flex items-center gap-1 font-medium text-muted-foreground">
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
        <span className="ml-auto text-muted-foreground">
          Hover a booked stall to see vendor + add-ons
        </span>
      </div>

      {/* Canvas — fit-to-width, same approach as the public eventfront map.
          The inner board renders at natural size and is CSS-scaled down so the
          spacing/proportions match the eventfront exactly. */}
      <div
        ref={venueScrollRef}
        className="relative border-2 border-dashed border-border rounded-xl bg-muted overflow-auto p-4"
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
            renderSpaceLabel={renderNothingFn}
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

