// The Analytics tab's CSV export — the same content as its PDF, from the
// same report data, laid out as blocks of rows so it opens cleanly in
// Excel: event details, a per-section summary, one table per section with
// everything it sells, members vs non-members, expenses and the revenue
// summary. Amounts are plain numbers (currency named once at the top) so
// they can be summed in Excel.

import type { EventReport } from "./eventReportPdf";
import type { MemberSplit, SplitGroup } from "./memberSplit";

type Cell = string | number | null | undefined;

const toCsv = (rows: Cell[][]) =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell == null ? "" : String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");

const money = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

export function buildEventReportCsv(
  event: any,
  report: EventReport,
  memberSplit: MemberSplit | null,
  currencyCode: string,
): string {
  const rows: Cell[][] = [];
  const blank = () => rows.push([]);
  const date = (d: any) => (d ? new Date(d).toLocaleDateString() : "");

  rows.push(["Event Report", event.title || ""]);
  rows.push(["Generated", new Date().toLocaleString()]);
  rows.push(["Amounts in", currencyCode]);
  blank();

  rows.push(["EVENT DETAILS"]);
  rows.push(["Title", event.title || ""]);
  rows.push(["Category", event.category || ""]);
  rows.push(["Location", event.location || ""]);
  rows.push(["Start Date", date(event.startDate)]);
  rows.push(["End Date", date(event.endDate)]);
  rows.push([
    "Visitor ticketing",
    report.hasVisitorTicketing ? "Yes" : "Not used for this event",
  ]);
  rows.push([
    "Sections",
    report.sections.map((s) => s.label).join("; ") || "None set up yet",
  ]);
  blank();

  // One line per section: headline, how full, revenue and its share.
  rows.push(["SECTIONS SUMMARY"]);
  rows.push(["Section", "Headline", "Sold", "Used", "Capacity", "% full", "Revenue", "% of revenue"]);
  const earned = report.sections.reduce((a, s) => a + Math.max(0, s.revenue), 0);
  for (const s of report.sections) {
    const f = s.fill && s.fill.total > 0 ? s.fill : null;
    rows.push([
      s.label,
      s.soldLabel,
      s.sold,
      f ? `${f.used} ${f.unit}` : "",
      f ? `${f.total} ${f.unit}` : "",
      f ? `${Math.round((f.used / f.total) * 100)}%` : "",
      money(s.revenue),
      earned > 0 ? `${Math.round((Math.max(0, s.revenue) / earned) * 100)}%` : "0%",
    ]);
  }
  rows.push(["Total Revenue", "", "", "", "", "", money(report.totalRevenue)]);
  blank();

  // A table per section with everything it sells. The partial fallback
  // has no per-item detail.
  if (!report.partial) {
    for (const s of report.sections) {
      rows.push([s.label.toUpperCase()]);
      rows.push(["Group", "Item", "Price", "Member price", "Sold", "Left", "Revenue"]);
      for (const g of s.groups) {
        for (const i of g.items) {
          rows.push([
            `${g.title} (${g.unit})`,
            i.name,
            i.priceVaries ? "Varies" : i.price == null ? "" : money(i.price),
            i.memberPrice == null ? "" : money(i.memberPrice),
            i.sold,
            i.left == null ? "" : i.left,
            money(i.revenue),
          ]);
        }
      }
      for (const a of s.adjustments) {
        rows.push(["", a.label, "", "", "", "", money(a.amount)]);
      }
      rows.push(["", `Total ${s.label.toLowerCase()}`, "", "", "", "", money(s.revenue)]);
      blank();

      // Only for events with a member rate on some sellable space.
      if (s.key === "exhibitors" && memberSplit) {
        const m = memberSplit.members;
        const n = memberSplit.nonMembers;
        const business = (g: SplitGroup) => g.rent + g.addOns;
        const line = (label: string, f: (g: SplitGroup) => number) =>
          rows.push([label, money(f(m)), money(f(n)), money(f(m) + f(n))]);
        rows.push(["MEMBERS VS NON-MEMBERS"]);
        rows.push(["", "Members", "Non-members", "Total"]);
        line("Bookings", (g) => g.bookings);
        line("Spaces booked", (g) => g.spaces);
        line("Space rent", (g) => g.rent);
        line("Add-ons", (g) => g.addOns);
        line("Business (rent + add-ons)", business);
        line("Deposits taken", (g) => g.deposit);
        if (m.depositReturned + n.depositReturned > 0) {
          line("Deposits returned", (g) => g.depositReturned);
        }
        line("Total billed", (g) => g.rent + g.addOns + g.deposit);
        const share = (a: number, b: number) =>
          a + b > 0 ? Math.round((a / (a + b)) * 100) : 0;
        const bs = share(business(m), business(n));
        const ds = share(m.deposit, n.deposit);
        rows.push(["Share of business", `${bs}%`, `${100 - bs}%`]);
        rows.push(["Share of deposits", `${ds}%`, `${100 - ds}%`]);
        blank();
      }
    }
  }

  const ex = report.expenses;
  if (ex && ex.items.length > 0) {
    rows.push(["EXPENSES"]);
    rows.push(["Expense", "Category", "Paid to", "Date", "Status", "Amount"]);
    for (const e of ex.items) {
      rows.push([e.title, e.category, e.paidTo, date(e.spentAt), e.status, money(e.amount)]);
    }
    if (ex.byCategory.length > 0) {
      blank();
      rows.push(["Approved, by category", "Entries", "", "", "", "Amount"]);
      for (const c of ex.byCategory) {
        rows.push([c.category, c.count, "", "", "", money(c.amount)]);
      }
    }
    if (ex.pending > 0) {
      rows.push(["Pending approval (not counted)", "", "", "", "", money(ex.pending)]);
    }
    rows.push(["Total expenses", "", "", "", "", money(ex.total)]);
    blank();
  }

  rows.push(["REVENUE SUMMARY"]);
  for (const s of report.sections) rows.push([s.label, money(s.revenue)]);
  rows.push(["Total Revenue", money(report.totalRevenue)]);
  blank();

  // Revenue less every deduction.
  const p = report.profit;
  if (p) {
    rows.push(["NET PROFIT"]);
    rows.push(["Total Revenue", money(p.revenue)]);
    for (const d of p.deductions) rows.push([`Less: ${d.label}`, money(-d.amount)]);
    rows.push([p.netProfit >= 0 ? "Net Profit" : "Net Loss", money(p.netProfit)]);
    rows.push(["Margin", p.margin != null ? `${p.margin}%` : ""]);
    blank();
    if (p.platformFeeLines.length > 0) {
      rows.push(["EVENTSH PLATFORM FEE"]);
      rows.push(["Charged on", "Count", "Rate", "Amount"]);
      for (const l of p.platformFeeLines) {
        rows.push([l.label, l.count, money(l.rate), money(l.amount)]);
      }
      rows.push([
        "Total platform fee",
        "",
        "",
        money(p.platformFeeLines.reduce((a, l) => a + l.amount, 0)),
      ]);
      blank();
    }
    if (ex && ex.pending > 0) {
      rows.push(["Expenses awaiting approval (not taken off)", money(ex.pending)]);
    }
    if (p.supplierOutstanding > 0) {
      rows.push(["Still owed to suppliers (not taken off until paid)", money(p.supplierOutstanding)]);
    }
  }
  rows.push([
    "Counts money received: tickets with payment confirmed, exhibitor and round-table bookings marked paid, confirmed sponsors, and paid workshops, scheduled slots and speaker fees. Security deposits are refundable, so they come off revenue; only approved expenses are taken off.",
  ]);

  // BOM so Excel reads the file as UTF-8 (names with accents, "—").
  return "﻿" + toCsv(rows);
}
