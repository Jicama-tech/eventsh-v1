// Infographic PDF for the Scheduled Spaces analytics: KPI cards, slot status,
// occupancy by facility type and by date, every space, and - when bookings
// came through event agents - agent graphs (slots sold per agent, share of
// agent sales, money alongside). Data is the payload of
// GET /scheduled-spaces/analytics/:eventId.

import type { jsPDF } from "jspdf";
import { pctText } from "./eventReportPdf";

type RGB = [number, number, number];

const INK: RGB = [20, 20, 20];
const GRAY: RGB = [107, 114, 128];
const LIGHT: RGB = [243, 244, 246];
const INDIGO: RGB = [99, 102, 241];
const BLUE: RGB = [59, 130, 246];
const GREEN: RGB = [34, 197, 94];
const AMBER: RGB = [245, 158, 11];
const RED: RGB = [239, 68, 68];
const SLATE: RGB = [148, 163, 184];
const WHITE: RGB = [255, 255, 255];

export function buildScheduledSpacesPdf(
  doc: jsPDF,
  data: any,
  opts: { eventTitle: string; money: (v: number) => string },
): void {
  const { money } = opts;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const W = pageW - margin * 2;
  let y = margin;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const clip = (t: string, w: number) =>
    (doc.splitTextToSize(String(t ?? "") || "-", Math.max(10, w)) as string[])[0] || "";
  const need = (h: number) => {
    if (y + h > pageH - 40) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (title: string, sub?: string) => {
    need(40);
    text(INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, margin, y + 10);
    y += 16;
    if (sub) {
      text(GRAY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(sub, margin, y + 6);
      y += 12;
    }
    y += 4;
  };
  const hbar = (
    label: string,
    right: string,
    value: number,
    max: number,
    color: RGB,
    labelW = W * 0.28,
    rightW = 150,
  ) => {
    need(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    text(INK);
    doc.text(clip(label, labelW - 6), margin, y + 9);
    const bx = margin + labelW;
    const bw = W - labelW - rightW;
    fill(LIGHT);
    doc.roundedRect(bx, y, bw, 12, 3, 3, "F");
    if (value > 0 && max > 0) {
      fill(color);
      doc.roundedRect(bx, y, Math.max(4, Math.min(1, value / max) * bw), 12, 3, 3, "F");
    }
    doc.setFont("helvetica", "normal");
    text(GRAY);
    doc.text(right, margin + W, y + 9, { align: "right" });
    y += 22;
  };

  const t = data.totals || {};
  const r = data.requests || {};

  // ── Header band ────────────────────────────────────────────────────────
  fill(INDIGO);
  doc.roundedRect(margin, y, W, 58, 8, 8, "F");
  text(WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Scheduled Spaces Report", margin + 16, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(clip(opts.eventTitle, W - 32), margin + 16, y + 42);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString()}`, margin + W - 16, y + 42, {
    align: "right",
  });
  y += 74;

  // ── KPI cards ──────────────────────────────────────────────────────────
  const kpis: [string, string, RGB][] = [
    ["SPACES", String(t.spaces ?? 0), INDIGO],
    ["TIME SLOTS", String(t.slots ?? 0), INDIGO],
    ["OCCUPANCY", `${t.occupancy ?? 0}%`, BLUE],
    ["SEATS LEFT", String(t.capacityRemaining ?? 0), GREEN],
    ["REGISTERED", String(r.total ?? 0), INDIGO],
    ["CONFIRMED", String(r.byStatus?.Completed || 0), GREEN],
    ["REVENUE (CONFIRMED)", money(r.revenueConfirmed || 0), GREEN],
    ["REVENUE (PENDING)", money(r.revenuePending || 0), AMBER],
  ];
  const cw = (W - 3 * 10) / 4;
  kpis.forEach(([label, value, color], i) => {
    const cx = margin + (i % 4) * (cw + 10);
    const cy = y + Math.floor(i / 4) * 58;
    fill(LIGHT);
    doc.roundedRect(cx, cy, cw, 48, 6, 6, "F");
    fill(color);
    doc.roundedRect(cx, cy, 4, 48, 2, 2, "F");
    text(GRAY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, cx + 12, cy + 15);
    text(INK);
    let fs = 15;
    doc.setFontSize(fs);
    while (fs > 8 && doc.getTextWidth(value) > cw - 20) {
      fs -= 0.5;
      doc.setFontSize(fs);
    }
    doc.text(value, cx + 12, cy + 36);
  });
  y += 58 * 2 + 8;

  // ── Slot status stacked bar ────────────────────────────────────────────
  heading("Slot status", "How many time slots are open, filling or full.");
  const slotTotal = (t.slotsAvailable || 0) + (t.slotsPartial || 0) + (t.slotsFull || 0);
  const parts: [string, number, RGB][] = [
    ["Open", t.slotsAvailable || 0, GREEN],
    ["Filling", t.slotsPartial || 0, AMBER],
    ["Full", t.slotsFull || 0, RED],
  ];
  need(46);
  fill(LIGHT);
  doc.roundedRect(margin, y, W, 16, 4, 4, "F");
  let sx = margin;
  for (const [, n, c] of parts) {
    if (n <= 0 || slotTotal <= 0) continue;
    const w = (n / slotTotal) * W;
    fill(c);
    doc.rect(sx, y, w, 16, "F");
    sx += w;
  }
  y += 28;
  doc.setFontSize(8.5);
  let lx = margin;
  for (const [label, n, c] of parts) {
    fill(c);
    doc.circle(lx + 4, y - 3, 3, "F");
    text(INK);
    doc.setFont("helvetica", "normal");
    const txt = `${label}: ${n} (${pctText(n, slotTotal)})`;
    doc.text(txt, lx + 12, y);
    lx += doc.getTextWidth(txt) + 30;
  }
  y += 18;

  // ── By facility type ───────────────────────────────────────────────────
  const facilities: any[] = data.byFacility || [];
  if (facilities.length > 0) {
    heading("Occupancy by facility type", "Seats booked out of seats available.");
    for (const f of facilities) {
      hbar(
        f.facilityType,
        `${f.booked}/${f.capacity} seats · ${f.slots} slots · ${f.slotsFull} full`,
        f.booked,
        f.capacity,
        BLUE,
      );
    }
    y += 4;
  }

  // ── By date (vertical bars) ────────────────────────────────────────────
  const dates: any[] = (data.byDate || []).slice(0, 24);
  if (dates.length > 0) {
    heading("Occupancy by date", "Share of each day's seats that are booked.");
    const chartH = 90;
    need(chartH + 48);
    y += 10;
    const gap = 6;
    const bw = Math.min(34, (W - gap * (dates.length - 1)) / dates.length);
    const totalW = bw * dates.length + gap * (dates.length - 1);
    const x0 = margin + (W - totalW) / 2;
    dates.forEach((d, i) => {
      const pct = d.capacity > 0 ? d.booked / d.capacity : 0;
      const bx = x0 + i * (bw + gap);
      fill(LIGHT);
      doc.roundedRect(bx, y, bw, chartH, 3, 3, "F");
      if (pct > 0) {
        fill(pct >= 1 ? RED : pct > 0.5 ? AMBER : BLUE);
        const h = Math.max(3, pct * chartH);
        doc.roundedRect(bx, y + chartH - h, bw, h, 3, 3, "F");
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      text(INK);
      doc.text(`${Math.round(pct * 100)}%`, bx + bw / 2, y - 2, { align: "center" });
      doc.setFont("helvetica", "normal");
      text(GRAY);
      const dd = new Date(`${d.date}T00:00:00`);
      doc.text(
        Number.isNaN(dd.getTime())
          ? String(d.date)
          : dd.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        bx + bw / 2,
        y + chartH + 10,
        { align: "center" },
      );
    });
    y += chartH + 26;
  }

  // ── Every space ────────────────────────────────────────────────────────
  const spaces: any[] = data.spaces || [];
  if (spaces.length > 0) {
    heading("Spaces", "Seats booked per space across all its time slots.");
    for (const sp of spaces) {
      const capacity = (sp.slots || []).reduce((n: number, s: any) => n + s.capacity, 0);
      const booked = (sp.slots || []).reduce((n: number, s: any) => n + s.booked, 0);
      const full = (sp.slots || []).filter((s: any) => s.state === "full").length;
      hbar(
        `${sp.name}${sp.forSale ? "" : " (not for sale)"}`,
        `${booked}/${capacity} seats · ${(sp.slots || []).length} slots · ${full} full`,
        booked,
        capacity,
        sp.forSale ? INDIGO : SLATE,
        W * 0.3,
        170,
      );
    }
    y += 4;
  }

  // ── Agents ─────────────────────────────────────────────────────────────
  const ag = data.agents;
  if (ag && ag.agents?.length) {
    const viaSlots = ag.viaAgents.slots;
    const allSlots = viaSlots + ag.direct.slots;
    const withMoney = (slots: number, confirmed: number) =>
      confirmed > 0 ? `${slots} slots · ${money(confirmed)}` : `${slots} slots`;

    // Keep the agent graphs together on one page where they fit.
    need(300);
    heading(
      "Agent performance",
      "Slots booked through each agent's referral link. Free bookings count; money is shown alongside.",
    );
    // via agents vs direct
    need(54);
    fill(LIGHT);
    doc.roundedRect(margin, y, W, 14, 4, 4, "F");
    if (viaSlots > 0 && allSlots > 0) {
      fill(INDIGO);
      doc.roundedRect(margin, y, Math.max(8, (viaSlots / allSlots) * W), 14, 4, 4, "F");
    }
    y += 26;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    fill(INDIGO);
    doc.circle(margin + 4, y - 3, 3, "F");
    text(INK);
    doc.text(
      `Via agents: ${withMoney(viaSlots, ag.viaAgents.revenueConfirmed)} (${pctText(viaSlots, allSlots)})`,
      margin + 12,
      y,
    );
    fill(SLATE);
    doc.circle(margin + W * 0.55, y - 3, 3, "F");
    doc.text(
      `Direct: ${withMoney(ag.direct.slots, ag.direct.revenueConfirmed)} (${pctText(ag.direct.slots, allSlots)})`,
      margin + W * 0.55 + 8,
      y,
    );
    y += 20;

    // ranked agents, bar = share of agent sales
    ag.agents.slice(0, 15).forEach((a: any, i: number) => {
      hbar(
        `${i + 1}. ${a.name}`,
        `${withMoney(a.slots, a.revenueConfirmed)} · ${pctText(a.slots, viaSlots)} of agent sales`,
        a.slots,
        viaSlots,
        INDIGO,
        W * 0.26,
        230,
      );
    });
    if (ag.agents.length > 15) {
      text(GRAY);
      doc.setFontSize(8);
      doc.text(`+ ${ag.agents.length - 15} more agents in the table below.`, margin, y);
      y += 14;
    }

    // table
    y += 6;
    // Header plus a few rows stay together.
    need(20 + 18 * Math.min(ag.agents.length, 4));
    const cols = {
      agent: margin + 8,
      code: margin + W * 0.3,
      book: margin + W * 0.46,
      slots: margin + W * 0.56,
      people: margin + W * 0.64,
      conf: margin + W * 0.745,
      share: margin + W - 8,
    };
    fill(LIGHT);
    doc.roundedRect(margin, y, W, 20, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    text(GRAY);
    doc.text("AGENT", cols.agent, y + 13);
    doc.text("CODE", cols.code, y + 13);
    doc.text("BOOKINGS", cols.book, y + 13);
    doc.text("SLOTS", cols.slots, y + 13);
    doc.text("PEOPLE", cols.people, y + 13);
    doc.text("CONFIRMED", cols.conf, y + 13);
    doc.text("% OF AGENTS", cols.share, y + 13, { align: "right" });
    y += 22;
    ag.agents.forEach((a: any, i: number) => {
      need(18);
      if (i % 2 === 0) {
        fill(LIGHT);
        doc.rect(margin, y - 2, W, 18, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      text(INK);
      doc.text(clip(a.name, cols.code - cols.agent - 6), cols.agent, y + 10);
      doc.text(clip(a.code, cols.book - cols.code - 6), cols.code, y + 10);
      doc.text(String(a.bookings), cols.book, y + 10);
      doc.text(String(a.slots), cols.slots, y + 10);
      doc.text(String(a.people), cols.people, y + 10);
      doc.text(money(a.revenueConfirmed), cols.conf, y + 10);
      doc.text(pctText(a.slots, viaSlots), cols.share, y + 10, { align: "right" });
      y += 18;
    });
    y += 6;
    text(GRAY);
    doc.setFontSize(7.5);
    doc.text(
      "Counts bookings awaiting approval or confirmed. Confirmed money only; pending payments are not included.",
      margin,
      y + 6,
    );
  }

  // ── Page numbers ───────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    text(GRAY);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, pageH - 18, { align: "right" });
  }
}
