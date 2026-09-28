// Members vs non-members split of an event's exhibitor bookings — how much
// business (space rent + add-ons) and how much security deposit came from
// each side. Shared by the Space Analytics PDF and the Analytics tab's event
// report PDF so both show the same numbers.
//
// Only meaningful when the event offers a member rate on some sellable
// space; otherwise everyone pays the same and computeMemberSplit returns null.

import type { jsPDF } from "jspdf";

// Bookings that did business: paid (in full, in part, or pending the
// organizer's approval), finished, or finished with the deposit already
// given back. Confirmed without spaces (approved, not yet paid) is skipped
// below by its empty selectedTables.
const BOOKED_STATUSES = new Set([
  "Processing",
  "Confirmed",
  "Paid",
  "Partial",
  "Completed",
  "Returned",
]);

// Flatten venueTables, which is sometimes a flat array and sometimes a
// Record<venueConfigId, table[]> (multi-layout events).
export function flattenPlaced(venueTables: any): any[] {
  if (Array.isArray(venueTables)) return venueTables;
  if (venueTables && typeof venueTables === "object") {
    return Object.values(venueTables).flatMap((v) =>
      Array.isArray(v) ? v : [],
    );
  }
  return [];
}

// Optional numeric price field: unset / blank means "no value" (a template
// without a member rate stores memberPrice as undefined).
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface SplitGroup {
  bookings: number;
  spaces: number;
  rent: number;
  addOns: number;
  deposit: number;
  depositReturned: number;
}

export interface MemberSplit {
  members: SplitGroup;
  nonMembers: SplitGroup;
  memberStallIds: Set<string>;
}

/**
 * A booking doesn't store which tier it was charged, so it's read off the
 * price: a space charged its member rate (or member deposit) where that
 * differs from the regular one is a member booking; charged the regular
 * rate, a non-member one. When the price can't tell (coupon, same rate on
 * both tiers, price edited since), the vendor's current membership decides.
 */
export function computeMemberSplit(
  event: any,
  stalls: any[],
  /** Which bookings count; defaults to every booking that did business.
   * The event report passes "paid only" to match its exhibitor figures. */
  counts: (stall: any) => boolean = (s) => BOOKED_STATUSES.has(s?.status),
): MemberSplit | null {
  if (!event) return null;
  const tpls: any[] = Array.isArray(event.tableTemplates)
    ? event.tableTemplates.filter((t: any) => t?.forSale !== false)
    : [];
  const tplById = new Map<string, any>(tpls.map((t) => [String(t.id), t]));
  const placed = flattenPlaced(event.venueTables).filter(
    (p) => p?.forSale !== false,
  );
  const placedByPos = new Map<string, any>(
    placed.map((p) => [p.positionId, p]),
  );

  const hasMemberRate = (x: any) =>
    num(x?.memberPrice) != null || num(x?.memberDepositPrice) != null;
  if (!tpls.some(hasMemberRate) && !placed.some(hasMemberRate)) return null;

  // Same fallback as the booking flow: placed space first, then template.
  const tiersOf = (p: any) => {
    const tpl = tplById.get(String(p?.id));
    return {
      memberPrice: num(p?.memberPrice) ?? num(tpl?.memberPrice),
      regularPrice:
        num(p?.tablePrice) ?? num(tpl?.tablePrice) ?? num(tpl?.price),
      memberDeposit: num(p?.memberDepositPrice) ?? num(tpl?.memberDepositPrice),
      regularDeposit: num(p?.depositPrice) ?? num(tpl?.depositPrice),
    };
  };
  const bookedAsMember = (s: any): boolean => {
    let regular = false;
    for (const t of s.selectedTables || []) {
      // A space removed from the layout since still has its template.
      const p = placedByPos.get(t?.positionId) || { id: t?.tableId };
      const tier = tiersOf(p);
      const price = num(t.price);
      const dep = num(t.depositAmount);
      if (
        price != null &&
        tier.memberPrice != null &&
        tier.regularPrice != null &&
        tier.memberPrice !== tier.regularPrice
      ) {
        if (price === tier.memberPrice) return true;
        if (price === tier.regularPrice) regular = true;
      }
      if (
        dep != null &&
        tier.memberDeposit != null &&
        tier.regularDeposit != null &&
        tier.memberDeposit !== tier.regularDeposit
      ) {
        if (dep === tier.memberDeposit) return true;
        if (dep === tier.regularDeposit) regular = true;
      }
    }
    return regular ? false : !!s?.shopkeeperId?.isMember;
  };

  const empty = (): SplitGroup => ({
    bookings: 0,
    spaces: 0,
    rent: 0,
    addOns: 0,
    deposit: 0,
    depositReturned: 0,
  });
  const members = empty();
  const nonMembers = empty();
  const memberStallIds = new Set<string>();
  for (const s of stalls) {
    const tables = s?.selectedTables || [];
    if (!counts(s) || tables.length === 0) continue;
    const rent =
      Number(s.tablesTotal) ||
      tables.reduce((a: number, t: any) => a + (Number(t.price) || 0), 0);
    const deposit =
      Number(s.depositTotal) ||
      tables.reduce(
        (a: number, t: any) => a + (Number(t.depositAmount) || 0),
        0,
      );
    const addOns =
      Number(s.addOnsTotal) ||
      (s.selectedAddOns || []).reduce(
        (a: number, x: any) =>
          a + (Number(x.price) || 0) * (Number(x.quantity) || 1),
        0,
      );
    const isMember = bookedAsMember(s);
    if (isMember) memberStallIds.add(String(s._id));
    const g = isMember ? members : nonMembers;
    g.bookings += 1;
    g.spaces += tables.length;
    g.rent += rent;
    g.addOns += addOns;
    g.deposit += deposit;
    if (s.depositReturned || s.status === "Returned") {
      g.depositReturned += deposit;
    }
  }
  return { members, nonMembers, memberStallIds };
}

/** Upper bound of the section's height, for the caller's page break. */
export const MEMBER_SPLIT_PDF_HEIGHT = 330;

type RGB = [number, number, number];
const PURPLE: RGB = [139, 92, 246];
const BLUE: RGB = [59, 130, 246];
const GRAY: RGB = [107, 114, 128];
const INK: RGB = [23, 23, 23];
const LIGHT: RGB = [243, 244, 246];
const TRACK: RGB = [229, 231, 235];

/**
 * Draw the "Members vs non-members" section at (x, y): a Members /
 * Non-members / Total table, then share bars for business and deposits.
 * Returns the y below the section. Amounts go through `money`, so each PDF
 * keeps its own currency style (Helvetica has no ₹ glyph).
 */
export function drawMemberSplitPdf(
  doc: jsPDF,
  split: MemberSplit,
  opts: { x: number; y: number; width: number; money: (v: number) => string },
): number {
  const { x, width, money } = opts;
  let y = opts.y;
  const m = split.members;
  const n = split.nonMembers;
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const business = (g: SplitGroup) => g.rent + g.addOns;
  const billed = (g: SplitGroup) => g.rent + g.addOns + g.deposit;

  text(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Members vs non-members", x, y);
  text(GRAY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const note = doc.splitTextToSize(
    "Exhibitor bookings, split by the rate they booked at. Business is space rent plus add-ons; security deposits are refundable, so they are shown on their own.",
    width,
  );
  doc.text(note, x, y + 14);
  y += 14 + note.length * 11 + 6;

  const colM = x + width * 0.6;
  const colN = x + width * 0.8;
  const colT = x + width - 12;

  // header strip with a colour key per group
  fill(LIGHT);
  doc.roundedRect(x, y, width, 22, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const headY = y + 14;
  const keyedHead = (label: string, cx: number, color: RGB) => {
    text(GRAY);
    doc.text(label, cx, headY, { align: "right" });
    fill(color);
    doc.circle(cx - doc.getTextWidth(label) - 7, headY - 3, 3, "F");
  };
  keyedHead("MEMBERS", colM, PURPLE);
  keyedHead("NON-MEMBERS", colN, BLUE);
  text(GRAY);
  doc.text("TOTAL", colT, headY, { align: "right" });
  y += 22;

  const row = (label: string, f: (g: SplitGroup) => number, isMoney = true, key = false) => {
    const fmt = (v: number) => (isMoney ? money(v) : String(v));
    return { label, m: fmt(f(m)), n: fmt(f(n)), t: fmt(f(m) + f(n)), key };
  };
  const rows = [
    row("Bookings", (g) => g.bookings, false),
    row("Spaces booked", (g) => g.spaces, false),
    row("Space rent", (g) => g.rent),
    row("Add-ons", (g) => g.addOns),
    row("Business (rent + add-ons)", business, true, true),
    row("Deposits taken", (g) => g.deposit, true, true),
    ...(m.depositReturned + n.depositReturned > 0
      ? [row("Deposits returned", (g) => g.depositReturned)]
      : []),
    row("Total billed", billed),
  ];
  const rowH = 20;
  rows.forEach((r, idx) => {
    if (idx % 2 === 1) {
      fill([249, 250, 251]);
      doc.rect(x, y, width, rowH, "F");
    }
    const ty = y + 13.5;
    text(INK);
    doc.setFont("helvetica", r.key ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(r.label, x + 12, ty);
    doc.text(r.m, colM, ty, { align: "right" });
    doc.text(r.n, colN, ty, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(r.t, colT, ty, { align: "right" });
    y += rowH;
  });
  doc.setDrawColor(232, 234, 240);
  doc.line(x, y, x + width, y);
  y += 22;

  // Share bars: members' slice (purple) over the non-member track (blue).
  const shareBar = (label: string, a: number, b: number) => {
    const total = a + b;
    text(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(label, x, y);
    text(GRAY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const pa = total > 0 ? Math.round((a / total) * 100) : 0;
    doc.text(
      total > 0
        ? `Members ${pa}%  ·  Non-members ${100 - pa}%`
        : "Nothing taken yet",
      x + width,
      y,
      { align: "right" },
    );
    y += 7;
    fill(total > 0 ? BLUE : TRACK);
    doc.roundedRect(x, y, width, 10, 5, 5, "F");
    if (total > 0 && a > 0) {
      fill(PURPLE);
      doc.roundedRect(x, y, Math.max(10, (width * a) / total), 10, 5, 5, "F");
    }
    y += 26;
  };
  shareBar("Share of business", business(m), business(n));
  shareBar("Share of deposits", m.deposit, n.deposit);
  return y + 4;
}
