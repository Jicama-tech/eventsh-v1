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

/** What the organizer logged as spent. Approved counts; pending is listed
 * but not taken off. */
export interface ReportExpenses {
  total: number;
  pending: number;
  byCategory: { category: string; amount: number; count: number }[];
  items: {
    title: string;
    category: string;
    amount: number;
    spentAt: string | null;
    paidTo: string;
    status: string;
  }[];
}

/** Net profit: money received less everything that comes off it. */
export interface ReportProfit {
  revenue: number;
  /** Deposits, expenses, supplier payouts, EventSH platform fee. */
  deductions: { key: string; label: string; amount: number }[];
  netProfit: number;
  /** % of revenue; null with no revenue. */
  margin: number | null;
  /** Owed on accepted supplier quotes but not paid yet — not taken off. */
  supplierOutstanding: number;
  /** What the platform fee is made of (only lines with a count). */
  platformFeeLines: { label: string; count: number; rate: number; amount: number }[];
}

/** "12.5%" — one decimal so small shares don't read as 0%; "—" when there
 * is nothing to take a share of. */
export const pctText = (value: number, base: number): string =>
  base > 0 ? `${(Math.round((value / base) * 1000) / 10).toString()}%` : "—";

export type AgentSectionKey = Exclude<SectionKey, "sponsors">;

export interface AgentRow {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  bookings: number;
  /** Spaces / tickets / slots sold (free ones included) - what agents are ranked by. */
  units: number;
  /** Money received, shown alongside. */
  revenue: number;
  bySection: Partial<Record<AgentSectionKey, { bookings: number; units: number; revenue: number }>>;
}

/** Bookings and revenue by the event agent they came through. */
export interface AgentBreakdown {
  /** Best performer first; agents with no bookings are included. */
  agents: AgentRow[];
  viaAgents: { bookings: number; units: number; revenue: number };
  /** Bookings with no agent credited. */
  direct: { bookings: number; units: number; revenue: number };
  /** Every booking credited to an agent, paid or not. */
  bookings: AgentBooking[];
}

export interface AgentBooking {
  agentId: string;
  agentName: string;
  section: AgentSectionKey;
  customer: string;
  item: string;
  amount: number;
  status: string;
  /** Paid, so counted in the agent's revenue. */
  /** Sold: holds a space / ticket / slot (free ones included). */
  counted: boolean;
  /** Spaces / tickets / slots in this booking (0 if not sold). */
  units: number;
  revenue: number;
  date: string | null;
}

export interface EventReport {
  hasVisitorTicketing: boolean;
  /** Null/missing when the event has no agents. */
  agents?: AgentBreakdown | null;
  totalRevenue: number;
  sections: ReportSection[];
  /** Missing on the partial fallback. */
  expenses?: ReportExpenses;
  /** Missing on the partial fallback. */
  profit?: ReportProfit;
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

/**
 * The event's logged expenses: one row per expense (pending ones marked and
 * left out of the total), then the approved spend by category, then the
 * total. Returns the y below the table.
 */
export function drawExpensesTable(
  doc: jsPDF,
  expenses: ReportExpenses,
  opts: {
    x: number;
    y: number;
    width: number;
    money: (v: number) => string;
    pageBreak: (y: number, need: number) => number;
  },
): number {
  const { x, width, money, pageBreak } = opts;
  const RED: RGB = [220, 38, 38];
  const INK: RGB = [20, 20, 20];
  const GRAY: RGB = [107, 114, 128];
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const ROW = 20;
  const cCat = x + width * 0.34;
  const cPaid = x + width * 0.52;
  const cDate = x + width * 0.7;
  const cStatus = x + width * 0.82;
  const cAmt = x + width - 12;
  const clip = (t: string, w: number) => doc.splitTextToSize(t || "—", w)[0] || "";

  let y = pageBreak(opts.y + 8, 26 + ROW * 3);
  fill(RED);
  doc.roundedRect(x, y, width, 26, 4, 4, "F");
  doc.rect(x, y + 22, width, 4, "F");
  text([255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("EXPENSES", x + 14, y + 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Total ${money(expenses.total)}`, x + width - 14, y + 17, {
    align: "right",
  });
  y += 26;

  const subHeader = (cells: [string, number, "left" | "right"][]) => {
    y = pageBreak(y, ROW * 2);
    fill([243, 244, 246]);
    doc.rect(x, y, width, 18, "F");
    text(GRAY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    for (const [label, cx, align] of cells) doc.text(label, cx, y + 12, { align });
    y += 18;
  };
  const line = (draw: (ty: number) => void, shade: RGB | null) => {
    y = pageBreak(y, ROW);
    if (shade) {
      fill(shade);
      doc.rect(x, y, width, ROW, "F");
    }
    draw(y + 13.5);
    y += ROW;
  };

  subHeader([
    ["EXPENSE", x + 12, "left"],
    ["CATEGORY", cCat, "left"],
    ["PAID TO", cPaid, "left"],
    ["DATE", cDate, "left"],
    ["STATUS", cStatus, "left"],
    ["AMOUNT", cAmt, "right"],
  ]);
  expenses.items.forEach((e, idx) =>
    line((ty) => {
      const pending = e.status !== "Approved";
      text(pending ? GRAY : INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(clip(e.title, cCat - x - 20), x + 12, ty);
      doc.text(clip(e.category, cPaid - cCat - 8), cCat, ty);
      doc.text(clip(e.paidTo, cDate - cPaid - 8), cPaid, ty);
      doc.text(e.spentAt ? new Date(e.spentAt).toLocaleDateString() : "—", cDate, ty);
      doc.text(e.status, cStatus, ty);
      doc.setFont("helvetica", "bold");
      doc.text(money(e.amount), cAmt, ty, { align: "right" });
    }, idx % 2 === 1 ? [249, 250, 252] : null),
  );

  if (expenses.byCategory.length > 0) {
    subHeader([
      ["APPROVED, BY CATEGORY", x + 12, "left"],
      ["ENTRIES", cStatus, "left"],
      ["AMOUNT", cAmt, "right"],
    ]);
    for (const c of expenses.byCategory) {
      line((ty) => {
        text(INK);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(c.category, x + 12, ty);
        doc.text(String(c.count), cStatus, ty);
        doc.setFont("helvetica", "bold");
        doc.text(money(c.amount), cAmt, ty, { align: "right" });
      }, null);
    }
  }
  if (expenses.pending > 0) {
    line((ty) => {
      text(GRAY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text("Pending approval (not counted)", x + 12, ty);
      doc.text(money(expenses.pending), cAmt, ty, { align: "right" });
    }, null);
  }
  line((ty) => {
    text(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Total expenses", x + 12, ty);
    doc.text(money(expenses.total), cAmt, ty, { align: "right" });
  }, [252, 226, 226]);
  return y + 6;
}


/** Rough height drawAgentsPdf needs, so the caller can page-break first. */
export const agentsPdfHeight = (b: AgentBreakdown) =>
  96 + Math.min(b.agents.length, 12) * 26 + 24;

/**
 * Agent performance infographic: a via-agents vs direct split bar, then one
 * ranked revenue bar per agent (best first, top 12 — the Excel export lists
 * everyone). Returns the y below it.
 */
export function drawAgentsPdf(
  doc: jsPDF,
  b: AgentBreakdown,
  opts: { x: number; y: number; width: number; money: (v: number) => string },
): number {
  const { x, width, money } = opts;
  const INK: RGB = [20, 20, 20];
  const GRAY: RGB = [107, 114, 128];
  const LIGHT: RGB = [243, 244, 246];
  const INDIGO: RGB = [99, 102, 241];
  const SLATE: RGB = [148, 163, 184];
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  let y = opts.y;

  text(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Agent performance", x, y);
  text(GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Paid bookings made through each agent's referral link.", x, y + 13);
  y += 26;

  // via agents vs direct
  // Shares are by units sold (spaces / tickets / slots), so free sales count;
  // money is shown next to them.
  const total = b.viaAgents.units + b.direct.units;
  const pct = total > 0 ? b.viaAgents.units / total : 0;
  const withMoney = (units: number, revenue: number) =>
    revenue > 0 ? `${units} sold · ${money(revenue)}` : `${units} sold`;
  fill(LIGHT);
  doc.roundedRect(x, y, width, 14, 4, 4, "F");
  if (pct > 0) {
    fill(INDIGO);
    doc.roundedRect(x, y, Math.max(8, width * pct), 14, 4, 4, "F");
  }
  y += 26;
  doc.setFontSize(8.5);
  fill(INDIGO);
  doc.circle(x + 4, y - 3, 3, "F");
  text(INK);
  doc.text(
    `Via agents: ${withMoney(b.viaAgents.units, b.viaAgents.revenue)} (${pctText(b.viaAgents.units, total)})`,
    x + 12,
    y,
  );
  fill(SLATE);
  doc.circle(x + width * 0.55, y - 3, 3, "F");
  doc.text(
    `Direct: ${withMoney(b.direct.units, b.direct.revenue)} (${pctText(b.direct.units, total)})`,
    x + width * 0.55 + 8,
    y,
  );
  y += 18;

  const shown = b.agents.slice(0, 12);
  // Bars are each agent's share of agent sales, so bar length = the %.
  const max = Math.max(1, b.viaAgents.units);
  const nameW = width * 0.3;
  const barX = x + nameW + 6;
  const barW = width - nameW - 6 - 210;
  shown.forEach((a, i) => {
    const clip = doc.splitTextToSize(`${i + 1}. ${a.name}`, nameW)[0] || "";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    text(INK);
    doc.text(clip, x, y + 9);
    fill(LIGHT);
    doc.roundedRect(barX, y, barW, 12, 3, 3, "F");
    if (a.units > 0) {
      fill(INDIGO);
      doc.roundedRect(barX, y, Math.max(4, (a.units / max) * barW), 12, 3, 3, "F");
    }
    doc.setFont("helvetica", "normal");
    text(GRAY);
    doc.text(
      `${withMoney(a.units, a.revenue)} · ${pctText(a.units, b.viaAgents.units)} of agent sales`,
      x + width,
      y + 9,
      { align: "right" },
    );
    y += 26;
  });
  if (b.agents.length > shown.length) {
    text(GRAY);
    doc.setFontSize(8);
    doc.text(`+ ${b.agents.length - shown.length} more agents in the Excel export.`, x, y);
    y += 14;
  }
  return y + 4;
}

/**
 * Every booking made through an agent: one row each, grouped by agent
 * (best performer first), with what was booked, the amount and its status.
 * Returns the y below the table.
 */
export function drawAgentBookingsPdf(
  doc: jsPDF,
  b: AgentBreakdown,
  sectionLabel: (key: string) => string,
  opts: {
    x: number;
    y: number;
    width: number;
    money: (v: number) => string;
    pageBreak: (y: number, need: number) => number;
  },
): number {
  const { x, width, money, pageBreak } = opts;
  const INK: RGB = [20, 20, 20];
  const GRAY: RGB = [107, 114, 128];
  const LIGHT: RGB = [243, 244, 246];
  const INDIGO: RGB = [99, 102, 241];
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const clip = (t: string, w: number) => doc.splitTextToSize(t || "—", w)[0] || "";
  const ROW = 18;
  const cSec = x + width * 0.2;
  const cCust = x + width * 0.34;
  const cItem = x + width * 0.55;
  const cStat = x + width * 0.8;
  const cAmt = x + width - 8;

  let y = pageBreak(opts.y + 8, 60);
  text(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Agent bookings", x, y);
  y += 16;

  for (const a of b.agents) {
    const list = b.bookings.filter((k) => k.agentId === a.id);
    if (list.length === 0) continue;
    y = pageBreak(y + 6, 22 + ROW * 2);
    fill(INDIGO);
    doc.roundedRect(x, y, width, 20, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(a.name, x + 8, y + 13);
    doc.text(
      `${a.bookings} paid · ${money(a.revenue)}`,
      x + width - 8,
      y + 13,
      { align: "right" },
    );
    y += 22;
    doc.setFontSize(7.5);
    text(GRAY);
    [
      ["DATE", x + 8],
      ["SECTION", cSec],
      ["CUSTOMER", cCust],
      ["BOOKED", cItem],
      ["STATUS", cStat],
    ].forEach(([h, hx]) => doc.text(h as string, hx as number, y + 9));
    doc.text("AMOUNT", cAmt, y + 9, { align: "right" });
    y += 14;
    list.forEach((k, i) => {
      y = pageBreak(y, ROW);
      if (i % 2 === 0) {
        fill(LIGHT);
        doc.rect(x, y - 2, width, ROW, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      text(INK);
      doc.text(clip(k.date ? new Date(k.date).toLocaleDateString() : "—", cSec - x - 12), x + 8, y + 10);
      doc.text(clip(sectionLabel(k.section), cCust - cSec - 4), cSec, y + 10);
      doc.text(clip(k.customer, cItem - cCust - 4), cCust, y + 10);
      doc.text(clip(k.item, cStat - cItem - 4), cItem, y + 10);
      text(k.counted ? [22, 163, 74] : GRAY);
      doc.text(clip(k.status, cAmt - cStat - 50), cStat, y + 10);
      text(INK);
      doc.text(money(k.amount), cAmt, y + 10, { align: "right" });
      y += ROW;
    });
  }
  return y + 8;
}
