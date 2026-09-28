// Section-by-section event report for the Analytics tab's PDF export. The
// numbers come from GET /analytics/event/:id/report — one section per thing
// the event uses (visitors, exhibitors, round tables, workshops, scheduled
// spaces, speakers, sponsors), each listing what it sells and what went.

import type { jsPDF } from "jspdf";

export interface ReportItem {
  name: string;
  /** Regular price; null when there's no single cash price. */
  price: number | null;
  /** Member rate, only where the organizer set one. */
  memberPrice?: number | null;
  sold: number;
  /** Still open; null = unlimited or not tracked. */
  left: number | null;
  revenue: number;
  /** Placed copies of this item are priced differently. */
  priceVaries?: boolean;
}

export type SectionKey =
  | "visitors"
  | "exhibitors"
  | "roundTables"
  | "workshops"
  | "scheduledSpaces"
  | "speakers"
  | "sponsors";

export interface ReportSection {
  key: SectionKey;
  label: string;
  sold: number;
  soldLabel: string;
  revenue: number;
  fill: { used: number; total: number; unit: string } | null;
  groups: { title: string; unit: string; items: ReportItem[] }[];
  adjustments: { label: string; amount: number }[];
}

export interface EventReport {
  hasVisitorTicketing: boolean;
  totalRevenue: number;
  sections: ReportSection[];
  /** Built from the dashboard's own totals because the report couldn't
   * load — headline figures only, no per-item tables. */
  partial?: boolean;
}

type RGB = [number, number, number];

export const SECTION_STYLE: Record<SectionKey, { color: RGB; glyph: string }> = {
  visitors: { color: [59, 130, 246], glyph: "T" },
  exhibitors: { color: [249, 115, 22], glyph: "E" },
  roundTables: { color: [139, 92, 246], glyph: "R" },
  workshops: { color: [20, 184, 166], glyph: "W" },
  scheduledSpaces: { color: [99, 102, 241], glyph: "S" },
  speakers: { color: [236, 72, 153], glyph: "M" },
  sponsors: { color: [217, 119, 6], glyph: "P" },
};

export async function fetchEventReport(
  apiURL: string,
  eventId: string,
  headers: Record<string, string>,
): Promise<EventReport | null> {
  try {
    const res = await fetch(`${apiURL}/analytics/event/${eventId}/report`, {
      headers,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.data?.sections) ? json.data : null;
  } catch {
    return null;
  }
}

/** Headline-only report from the dashboard's per-event metrics. */
export function fallbackReport(event: any): EventReport {
  const sections: ReportSection[] = [];
  const ticketsSold = Number(event.ticketsSold) || 0;
  const hasVisitors =
    (event.visitorTypes || []).some((v: any) => v?.isActive !== false) ||
    ticketsSold > 0;
  if (hasVisitors) {
    const capacity = Number(event.totalTickets) || 0;
    sections.push({
      key: "visitors",
      label: "Visitors",
      sold: ticketsSold,
      soldLabel: "Tickets sold",
      revenue: Number(event.ticketsRevenue) || 0,
      fill: capacity ? { used: ticketsSold, total: capacity, unit: "tickets" } : null,
      groups: [],
      adjustments: [],
    });
  }
  const spaces = Number(event.sellableSpaces) || 0;
  const booked = Number(event.stallsBooked) || 0;
  if (spaces > 0 || booked > 0) {
    sections.push({
      key: "exhibitors",
      label: "Exhibitors",
      sold: booked,
      soldLabel: "Spaces sold",
      revenue: Number(event.stallsRevenue) || 0,
      fill: spaces ? { used: booked, total: spaces, unit: "spaces" } : null,
      groups: [],
      adjustments: [],
    });
  }
  return {
    hasVisitorTicketing: hasVisitors,
    totalRevenue: sections.reduce((a, s) => a + s.revenue, 0),
    sections,
    partial: true,
  };
}

/**
 * One section as a table: a coloured header with the section's revenue, then
 * per group (e.g. Space types, Add-ons) a row per item — price, member price
 * where any is set, sold, left, revenue — then the adjustments that make the
 * items add up (discounts, deposits) and the section total.
 *
 * `pageBreak(y, need)` returns where to keep drawing, adding a page first
 * when `need` points won't fit. Returns the y below the table.
 */
export function drawSectionTable(
  doc: jsPDF,
  section: ReportSection,
  opts: {
    x: number;
    y: number;
    width: number;
    money: (v: number) => string;
    pageBreak: (y: number, need: number) => number;
  },
): number {
  const { x, width, pageBreak } = opts;
  const color = SECTION_STYLE[section.key]?.color || [107, 114, 128];
  const money = (v: number) => (v < 0 ? `-${opts.money(-v)}` : opts.money(v));
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const INK: RGB = [20, 20, 20];
  const GRAY: RGB = [107, 114, 128];
  const ROW = 20;

  let y = pageBreak(opts.y + 8, 26 + ROW * 3);
  fill(color);
  doc.roundedRect(x, y, width, 26, 4, 4, "F");
  doc.rect(x, y + 22, width, 4, "F");
  text([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(section.label.toUpperCase(), x + 14, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Revenue ${money(section.revenue)}`, x + width - 14, y + 17, {
    align: "right",
  });
  y += 26;

  const hasMember = section.groups.some((g) =>
    g.items.some((i) => i.memberPrice != null),
  );
  const colRev = x + width - 12;
  const colLeft = x + width * 0.8;
  const colSold = x + width * 0.68;
  const colMember = x + width * 0.56;
  const colPrice = x + width * (hasMember ? 0.44 : 0.54);
  const nameW = colPrice - 70 - (x + 12);
  const priceTxt = (v: number | null | undefined) =>
    v == null ? "—" : v === 0 ? "Free" : money(v);

  const row = (
    cells: { label: string; price?: string; member?: string; sold?: string; left?: string; rev?: string },
    shade: RGB | null,
    bold = false,
  ) => {
    y = pageBreak(y, ROW);
    if (shade) {
      fill(shade);
      doc.rect(x, y, width, ROW, "F");
    }
    const ty = y + 13.5;
    text(INK);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(cells.label, nameW)[0] || "", x + 12, ty);
    if (cells.price != null) doc.text(cells.price, colPrice, ty, { align: "right" });
    if (hasMember && cells.member != null)
      doc.text(cells.member, colMember, ty, { align: "right" });
    if (cells.sold != null) doc.text(cells.sold, colSold, ty, { align: "right" });
    if (cells.left != null) doc.text(cells.left, colLeft, ty, { align: "right" });
    if (cells.rev != null) {
      doc.setFont("helvetica", "bold");
      doc.text(cells.rev, colRev, ty, { align: "right" });
    }
    y += ROW;
  };

  const anything = section.groups.some((g) => g.items.length > 0);
  if (!anything) {
    y = pageBreak(y, ROW);
    text(GRAY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Nothing set up for this section yet.", x + 12, y + 13.5);
    doc.setFont("helvetica", "normal");
    return y + ROW + 6;
  }

  for (const g of section.groups) {
    // keep a group's header with at least its first row
    y = pageBreak(y, ROW * 2);
    fill([243, 244, 246]);
    doc.rect(x, y, width, 18, "F");
    text(GRAY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const hy = y + 12;
    doc.text(`${g.title.toUpperCase()}  (${g.unit})`, x + 12, hy);
    doc.text("PRICE", colPrice, hy, { align: "right" });
    if (hasMember) doc.text("MEMBER", colMember, hy, { align: "right" });
    doc.text("SOLD", colSold, hy, { align: "right" });
    doc.text("LEFT", colLeft, hy, { align: "right" });
    doc.text("REVENUE", colRev, hy, { align: "right" });
    y += 18;
    if (g.items.length === 0) {
      row({ label: "None set up." }, null);
      continue;
    }
    g.items.forEach((i, idx) =>
      row(
        {
          label: i.name,
          price: i.priceVaries ? "Varies" : priceTxt(i.price),
          member: i.memberPrice != null ? money(i.memberPrice) : "—",
          sold: String(i.sold),
          left: i.left == null ? "—" : String(i.left),
          rev: money(i.revenue),
        },
        idx % 2 === 1 ? [249, 250, 252] : null,
      ),
    );
  }
  for (const a of section.adjustments) {
    row({ label: a.label, rev: money(a.amount) }, null);
  }
  // total, tinted with the section colour
  row(
    { label: `Total ${section.label.toLowerCase()}`, rev: money(section.revenue) },
    [
      Math.round(color[0] + (255 - color[0]) * 0.88),
      Math.round(color[1] + (255 - color[1]) * 0.88),
      Math.round(color[2] + (255 - color[2]) * 0.88),
    ],
    true,
  );
  return y + 6;
}
