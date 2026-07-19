import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Eye,
  LayoutGrid,
  Loader2,
  Store,
  CheckCircle2,
  CircleSlash,
  Users,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from "lucide-react";
import { ExhibitorDetailDialog } from "./ExhibitorDetailDialog";

const apiURL = __API_URL__;

// Statuses that count as a booking of a space: Processing = vendor paid,
// pending organizer approval; Confirmed = payment verified; Completed =
// confirmed stall after the event. Pending/Approved (nothing paid) do NOT
// hold a space. Same rule as the dashboard Event Card and the chatbot's
// get_event_venue tool.
const SOLD_STATUSES = new Set(["Processing", "Confirmed", "Completed"]);

// Flatten venueTables, which is sometimes a flat array and sometimes a
// Record<venueConfigId, table[]> (multi-layout events).
function flattenPlaced(venueTables: any): any[] {
  if (Array.isArray(venueTables)) return venueTables;
  if (venueTables && typeof venueTables === "object") {
    return Object.values(venueTables).flatMap((v) =>
      Array.isArray(v) ? v : [],
    );
  }
  return [];
}

const brandNameOf = (stall: any): string =>
  stall?.shopkeeperId?.shopName ||
  stall?.businessName ||
  stall?.brandName ||
  stall?.shopkeeperId?.name ||
  stall?.nameOfApplicant ||
  "Unnamed exhibitor";

const emailOf = (stall: any): string =>
  stall?.shopkeeperId?.email || stall?.shopkeeperId?.businessEmail || "";
const phoneOf = (stall: any): string =>
  stall?.shopkeeperId?.phone || stall?.shopkeeperId?.whatsappNumber || "";

// Trigger a client-side file download from a Blob.
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.visibility = "hidden";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface TemplateStat {
  id: string;
  name: string;
  price?: number;
  total: number;
  booked: number;
  brands: {
    stall: any;
    name: string;
    spaces: number;
    status: string;
    spaceNames: string[];
  }[];
}

/**
 * Space-template analytics for an event. Lists each sellable space template,
 * and per template shows total placed spaces, how many are booked, and which
 * brands booked them. Clicking a brand's eye opens the full stall detail.
 *
 * Linking model (verified against real data):
 *   - placed space belongs to a template when placed.id === template.id
 *   - a placed space is "booked" when some stall's selectedTables[].positionId
 *     matches the placed space's positionId
 *   - brand name comes from the populated shopkeeperId.shopName
 */
export function EventSpaceAnalyticsDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: any;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null); // full event doc
  const [stalls, setStalls] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stallForDetail, setStallForDetail] = useState<any>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const eventId = event?._id;

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    setSelectedId(null);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = sessionStorage.getItem("token");
        const [evRes, stallRes] = await Promise.all([
          fetch(`${apiURL}/events/${eventId}`),
          fetch(`${apiURL}/stalls/event/${eventId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ]);
        const evJson = await evRes.json();
        const stallJson = await stallRes.json();
        if (cancelled) return;
        setDetail(evJson?.data || evJson);
        setStalls(
          Array.isArray(stallJson?.data)
            ? stallJson.data
            : Array.isArray(stallJson)
              ? stallJson
              : [],
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  // Compute per-template stats by joining placed spaces + bookings.
  const templates: TemplateStat[] = useMemo(() => {
    if (!detail) return [];
    const placed = flattenPlaced(detail.venueTables);
    const liveStalls = stalls.filter((s) => SOLD_STATUSES.has(s?.status));

    // positionId -> stall that booked it (first wins)
    const posToStall = new Map<string, any>();
    for (const s of liveStalls) {
      for (const t of s.selectedTables || []) {
        if (t?.positionId && !posToStall.has(t.positionId)) {
          posToStall.set(t.positionId, s);
        }
      }
    }

    const tpls = Array.isArray(detail.tableTemplates)
      ? detail.tableTemplates
      : [];
    return tpls
      // Only sellable templates belong in the analytics. A template the
      // organizer marked "Not for sale" (display-only area) is excluded —
      // either via its own forSale flag or, defensively, when every placed
      // space of it is forSale:false. Unset/true = sellable (older data).
      .filter((tpl: any) => {
        if (tpl.forSale === false) return false;
        const ofThis = placed.filter((p) => String(p.id) === String(tpl.id));
        if (ofThis.length > 0 && ofThis.every((p) => p.forSale === false))
          return false;
        return true;
      })
      .map((tpl: any) => {
      const tplPlaced = placed.filter(
        (p) => String(p.id) === String(tpl.id),
      );
      const tplPositionIds = new Set(
        tplPlaced.map((p) => p.positionId).filter(Boolean),
      );
      const bookedPlaced = tplPlaced.filter((p) =>
        posToStall.has(p.positionId),
      );

      // group bookings by brand for this template
      const byStall = new Map<string, TemplateStat["brands"][number]>();
      for (const p of tplPlaced) {
        const s = posToStall.get(p.positionId);
        if (!s) continue;
        const key = String(s._id);
        const existing = byStall.get(key);
        const spaceName = p.name || p.tableName || p.positionId;
        if (existing) {
          existing.spaces += 1;
          existing.spaceNames.push(spaceName);
        } else {
          byStall.set(key, {
            stall: s,
            name: brandNameOf(s),
            spaces: 1,
            status: s.status || "Pending",
            spaceNames: [spaceName],
          });
        }
      }

      return {
        id: String(tpl.id),
        name: tpl.name || "Untitled space",
        price: tpl.price ?? tpl.tablePrice,
        total: tplPlaced.length,
        booked: bookedPlaced.length,
        brands: Array.from(byStall.values()),
      };
    });
  }, [detail, stalls]);

  const selected = templates.find((t) => t.id === selectedId) || null;

  const eventTitle = event?.title || event?.name || "Event";
  const safeName = String(eventTitle).replace(/[^a-z0-9]/gi, "_");
  const stamp = new Date().toISOString().slice(0, 10);

  // Flat rows for the spreadsheet — one line per brand booking, plus a line
  // for templates that have no bookings yet so they still appear.
  const buildRows = (): string[][] => {
    const header = [
      "Template",
      "Price",
      "Total Spaces",
      "Booked",
      "Available",
      "Brand",
      "Spaces Booked",
      "Space Names",
      "Status",
      "Email",
      "Phone",
    ];
    const rows: string[][] = [header];
    for (const t of templates) {
      const available = Math.max(0, t.total - t.booked);
      if (t.brands.length === 0) {
        rows.push([
          t.name,
          t.price != null ? String(t.price) : "",
          String(t.total),
          String(t.booked),
          String(available),
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        continue;
      }
      for (const b of t.brands) {
        rows.push([
          t.name,
          t.price != null ? String(t.price) : "",
          String(t.total),
          String(t.booked),
          String(available),
          b.name,
          String(b.spaces),
          b.spaceNames.join(" | "),
          b.status,
          emailOf(b.stall),
          phoneOf(b.stall),
        ]);
      }
    }
    return rows;
  };

  // CSV — opens directly in Excel / Sheets.
  const exportCsv = () => {
    const csv = buildRows()
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `${safeName}_Space_Analytics_${stamp}.csv`,
    );
  };

  // PDF — an infographic-style report: header banner, KPI cards, an occupancy
  // donut, a per-template bar chart, then styled brand tables. jsPDF has no
  // chart/table primitives, so everything is drawn with rects/circles/arcs.
  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const innerW = pageW - margin * 2;

    type RGB = [number, number, number];
    const C = {
      primary: [99, 102, 241] as RGB,
      primaryDark: [79, 70, 229] as RGB,
      blue: [59, 130, 246] as RGB,
      green: [22, 163, 74] as RGB,
      amber: [217, 119, 6] as RGB,
      red: [220, 38, 38] as RGB,
      purple: [139, 92, 246] as RGB,
      gray: [107, 114, 128] as RGB,
      track: [229, 231, 235] as RGB,
      light: [243, 244, 246] as RGB,
      white: [255, 255, 255] as RGB,
      ink: [23, 23, 23] as RGB,
    };
    const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const draw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

    // Filled arc/pie slice (jsPDF lines-based, mirrors the dashboard report).
    const pieSlice = (
      cx: number,
      cy: number,
      r: number,
      startA: number,
      sweepA: number,
      color: RGB,
    ) => {
      if (sweepA <= 0) return;
      const steps = Math.max(20, Math.ceil(Math.abs(sweepA) * 36));
      const pts: [number, number][] = [[cx, cy]];
      for (let i = 0; i <= steps; i++) {
        const a = startA + sweepA * (i / steps);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      const deltas: [number, number][] = [];
      for (let i = 1; i < pts.length; i++)
        deltas.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
      fill(color);
      (doc as any).lines(deltas, pts[0][0], pts[0][1], [1, 1], "F", true);
    };

    const statusColor = (s: string): RGB => {
      const v = (s || "").toLowerCase();
      if (/(complete|confirm|paid|approv)/.test(v)) return C.green;
      if (/(cancel|reject|declin|fail)/.test(v)) return C.red;
      return C.amber; // pending / processing / default
    };

    // Totals for the summary section.
    const totalSpaces = templates.reduce((s, t) => s + t.total, 0);
    const totalBooked = templates.reduce((s, t) => s + t.booked, 0);
    const totalAvail = Math.max(0, totalSpaces - totalBooked);
    const totalBrands = templates.reduce((s, t) => s + t.brands.length, 0);
    const occupancy = totalSpaces ? Math.round((totalBooked / totalSpaces) * 100) : 0;

    // ===== HEADER BANNER =====
    const headerH = 86;
    fill(C.primaryDark);
    doc.rect(0, 0, pageW, headerH, "F");
    fill(C.primary);
    doc.circle(pageW - 26, 14, 54, "F");
    doc.circle(pageW - 80, headerH - 2, 30, "F");
    text(C.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("Space Analytics", margin, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const sub = doc.splitTextToSize(eventTitle, innerW - 160);
    doc.text(sub, margin, 58);
    doc.setFontSize(8);
    text([214, 219, 252]);
    doc.text(`Generated ${new Date().toLocaleString()}`, margin, headerH - 12);

    let y = headerH + 26;

    // ===== KPI CARDS =====
    const kpis: { label: string; value: string; color: RGB }[] = [
      { label: "Total Spaces", value: String(totalSpaces), color: C.blue },
      { label: "Booked", value: String(totalBooked), color: C.green },
      { label: "Available", value: String(totalAvail), color: C.amber },
      { label: "Brands", value: String(totalBrands), color: C.purple },
    ];
    const gap = 10;
    const cardW = (innerW - gap * 3) / 4;
    const cardH = 70;
    kpis.forEach((k, i) => {
      const cx = margin + i * (cardW + gap);
      fill(C.white);
      draw([230, 232, 240]);
      doc.roundedRect(cx, y, cardW, cardH, 7, 7, "FD");
      fill(k.color);
      doc.roundedRect(cx, y, cardW, 4, 7, 7, "F");
      doc.rect(cx, y + 2, cardW, 2, "F");
      text(C.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text(k.value, cx + 12, y + 38);
      text(C.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(k.label.toUpperCase(), cx + 12, y + 56);
    });
    y += cardH + 24;

    // ===== VIZ ROW: occupancy donut (left) + template bars (right) =====
    const panelGap = 16;
    const donutPanelW = 200;
    const barPanelW = innerW - donutPanelW - panelGap;
    const panelH = 188;

    // -- Donut panel --
    fill([250, 251, 254]);
    draw([230, 232, 240]);
    doc.roundedRect(margin, y, donutPanelW, panelH, 8, 8, "FD");
    text(C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Occupancy", margin + 14, y + 22);
    const dcx = margin + donutPanelW / 2;
    const dcy = y + panelH / 2 + 12;
    const dr = 54;
    if (totalSpaces > 0) {
      const start = -Math.PI / 2;
      const bookedSweep = (totalBooked / totalSpaces) * Math.PI * 2;
      pieSlice(dcx, dcy, dr, start, bookedSweep, C.green);
      pieSlice(dcx, dcy, dr, start + bookedSweep, Math.PI * 2 - bookedSweep, C.track);
    } else {
      fill(C.track);
      doc.circle(dcx, dcy, dr, "F");
    }
    fill(C.white);
    doc.circle(dcx, dcy, dr - 22, "F");
    text(C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`${occupancy}%`, dcx, dcy + 2, { align: "center" });
    text(C.gray);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("booked", dcx, dcy + 16, { align: "center" });
    // legend
    const legY = y + panelH - 18;
    fill(C.green);
    doc.circle(margin + 24, legY, 4, "F");
    text(C.gray);
    doc.setFontSize(8);
    doc.text(`Booked ${totalBooked}`, margin + 34, legY + 3);
    fill(C.track);
    doc.circle(margin + 110, legY, 4, "F");
    doc.text(`Available ${totalAvail}`, margin + 120, legY + 3);

    // -- Template bar chart panel --
    const bx = margin + donutPanelW + panelGap;
    fill([250, 251, 254]);
    draw([230, 232, 240]);
    doc.roundedRect(bx, y, barPanelW, panelH, 8, 8, "FD");
    text(C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Bookings by space template", bx + 14, y + 22);
    const rowsToShow = templates.slice(0, 6);
    const barAreaX = bx + 14;
    const barAreaW = barPanelW - 28;
    const labelW = Math.min(120, barAreaW * 0.34);
    const trackX = barAreaX + labelW + 6;
    const trackW = barAreaX + barAreaW - trackX - 36;
    let by = y + 40;
    const barGap = (panelH - 52) / Math.max(rowsToShow.length, 1);
    rowsToShow.forEach((t) => {
      const pct = t.total ? t.booked / t.total : 0;
      text(C.ink);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lbl = doc.splitTextToSize(t.name, labelW)[0];
      doc.text(lbl, barAreaX, by + 7);
      fill(C.track);
      doc.roundedRect(trackX, by, trackW, 9, 4, 4, "F");
      if (pct > 0) {
        fill(C.primary);
        doc.roundedRect(trackX, by, Math.max(4, trackW * pct), 9, 4, 4, "F");
      }
      text(C.gray);
      doc.setFontSize(8);
      doc.text(`${t.booked}/${t.total}`, trackX + trackW + 6, by + 8);
      by += barGap;
    });
    y += panelH + 26;

    // ===== PER-TEMPLATE DETAIL =====
    const ensure = (need: number) => {
      if (y + need > pageH - margin) {
        doc.addPage();
        y = margin + 6;
      }
    };

    text(C.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Template breakdown", margin, y);
    y += 16;

    for (const t of templates) {
      ensure(70);
      const available = Math.max(0, t.total - t.booked);
      const pct = t.total ? Math.round((t.booked / t.total) * 100) : 0;

      // Template header strip
      fill(C.light);
      doc.roundedRect(margin, y, innerW, 26, 6, 6, "F");
      text(C.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(t.name, margin + 12, y + 17);
      text(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const priceTxt = t.price != null ? `Price ${t.price}   ·   ` : "";
      doc.text(
        `${priceTxt}${t.booked}/${t.total} booked · ${available} available`,
        pageW - margin - 12,
        y + 17,
        { align: "right" },
      );
      y += 34;

      // occupancy bar
      const obW = innerW;
      fill(C.track);
      doc.roundedRect(margin, y, obW, 8, 4, 4, "F");
      if (pct > 0) {
        fill(C.green);
        doc.roundedRect(margin, y, Math.max(4, (obW * pct) / 100), 8, 4, 4, "F");
      }
      y += 20;

      if (t.brands.length === 0) {
        text(C.gray);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text("No bookings yet.", margin + 4, y);
        doc.setFont("helvetica", "normal");
        y += 22;
        continue;
      }

      // table header
      const cBrand = margin + 8;
      const cSpaces = margin + innerW * 0.62;
      const cStatus = margin + innerW * 0.78;
      ensure(20);
      text(C.gray);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("BRAND", cBrand, y);
      doc.text("SPACES", cSpaces, y, { align: "center" });
      doc.text("STATUS", cStatus, y);
      y += 6;
      draw([232, 234, 240]);
      doc.line(margin, y, margin + innerW, y);
      y += 12;

      t.brands.forEach((b, idx) => {
        const rowH = 26;
        ensure(rowH);
        if (idx % 2 === 1) {
          fill([249, 250, 251]);
          doc.rect(margin, y - 12, innerW, rowH, "F");
        }
        // brand + email
        text(C.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(
          doc.splitTextToSize(b.name, innerW * 0.55)[0],
          cBrand,
          y,
        );
        const email = emailOf(b.stall);
        if (email) {
          text(C.gray);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.text(email, cBrand, y + 10);
        }
        // spaces
        text(C.ink);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(String(b.spaces), cSpaces, y + 1, { align: "center" });
        // status pill
        const sc = statusColor(b.status);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        const pillW = doc.getTextWidth(b.status) + 14;
        // light tinted pill background (status colour mixed toward white)
        doc.setFillColor(
          Math.round(sc[0] + (255 - sc[0]) * 0.85),
          Math.round(sc[1] + (255 - sc[1]) * 0.85),
          Math.round(sc[2] + (255 - sc[2]) * 0.85),
        );
        doc.roundedRect(cStatus, y - 8, pillW, 14, 7, 7, "F");
        text(sc);
        doc.text(b.status, cStatus + 7, y + 1);
        y += rowH;
      });
      y += 12;
    }

    // ===== FOOTERS =====
    const pages = (doc as any).getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      text(C.gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `${eventTitle} — Space Analytics`,
        margin,
        pageH - 18,
      );
      doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 18, {
        align: "right",
      });
    }

    doc.save(`${safeName}_Space_Analytics_${stamp}.pdf`);
  };

  const canExport = !loading && !error && templates.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted"
                  aria-label="Back to templates"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <LayoutGrid className="h-5 w-5 text-primary" />
              )}
              <span className="flex-1">
                {selected
                  ? selected.name
                  : `Space Analytics — ${eventTitle}`}
              </span>
              {canExport && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="ml-auto">
                      <Download className="mr-1 h-4 w-4" /> Export
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportCsv} className="cursor-pointer">
                      <FileSpreadsheet className="mr-2 h-4 w-4" /> Export as Excel (CSV)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPdf} className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" /> Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? "Booking breakdown for this space template."
                : "Sellable space templates created for this event. Select one to see bookings."}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
              Loading analytics…
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-500">{error}</div>
          ) : !selected ? (
            // ----- LEVEL 1: template list -----
            templates.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground">
                <Store className="mx-auto mb-3 h-8 w-8 opacity-40" />
                No sellable space templates were created for this event.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedId(t.id)}
                    className="rounded-xl border bg-card p-4 text-left transition hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-800">
                        {t.name}
                      </span>
                      <Badge variant="secondary">{t.brands.length} brands</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <LayoutGrid className="h-4 w-4" /> {t.total} spaces
                      </span>
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" /> {t.booked} booked
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            // ----- LEVEL 2: template detail -----
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  label="Total Spaces"
                  value={selected.total}
                  icon={<LayoutGrid className="h-4 w-4" />}
                />
                <StatTile
                  label="Booked"
                  value={selected.booked}
                  tone="green"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <StatTile
                  label="Available"
                  value={Math.max(0, selected.total - selected.booked)}
                  tone="amber"
                  icon={<CircleSlash className="h-4 w-4" />}
                />
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-700">
                  <Users className="h-4 w-4" /> Brands who booked
                </p>
                {selected.brands.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                    No bookings yet for this space template.
                  </div>
                ) : (
                  <div className="divide-y rounded-xl border">
                    {selected.brands.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-stone-800">
                            {b.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {b.spaces} space{b.spaces === 1 ? "" : "s"} ·{" "}
                            {b.spaceNames.join(", ")}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{b.status}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View stall details"
                            onClick={() => setStallForDetail(b.stall)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reuse the existing read-only stall detail dialog. */}
      <ExhibitorDetailDialog
        open={!!stallForDetail}
        onOpenChange={(o) => !o && setStallForDetail(null)}
        stallRequest={stallForDetail}
        detailRef={detailRef}
      />
    </>
  );
}

function StatTile({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "green" | "amber";
}) {
  const tones: Record<string, string> = {
    default: "bg-muted/50 text-stone-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
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

export default EventSpaceAnalyticsDialog;
