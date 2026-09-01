/**
 * The super-admin's platform-fee invoice: what an organizer owes Eventsh.
 *
 * Styled to match the platform's other billing documents — the subscription
 * payment receipt (subscriptions.service.writeReceiptPdf) and the sponsorship
 * receipt (sponsors.service.buildInvoicePdf): dark navy header band, a
 * two-column billed-to / payment-details pair, a banded items table with
 * zebra rows, and a footer strip with a status pill. Those are pdfkit on the
 * server; this is jsPDF in the browser, so the drawing calls differ but the
 * palette, proportions and running order are deliberately the same.
 *
 * Kept out of the dialog component so the layout can be exercised on its own
 * (hand-positioned PDF is easy to break silently) and so the jspdf bundle
 * only loads when someone actually asks for an invoice.
 */

/** Only the parts of the super-admin billing payload the invoice reads. */
export interface InvoiceBilling {
  organizer: {
    _id: string;
    name?: string;
    organizationName?: string;
    email?: string;
    country?: string;
  };
  rates: {
    stall: number;
    roundTable: number;
    chair: number;
    speaker: number;
    membership: number;
    currency: string;
  };
  events: Array<{
    title?: string;
    startDate: string;
    stallsSold: number;
    tablesBooked: number;
    chairsBooked: number;
    speakersBooked: number;
  }>;
  memberships?: { active: number; amount: number };
  totals: { billable: number; paid: number; owed: number };
}

export interface InvoiceOptions {
  billing: InvoiceBilling;
  /** Company name and UEN from the platform PaymentConfig singleton. */
  company: { name: string; uen: string };
  /** Base64 data URL of the *static* PayNow QR. */
  qrDataUrl: string;
  /** Overridable so tests get a stable document. */
  issued?: Date;
}

/** Shared with the server-side receipts — slate, with a green/amber pill. */
const C = {
  ink: "#0f172a",
  body: "#1f2937",
  muted: "#64748b",
  line: "#e2e8f0",
  zebra: "#f8fafc",
  band: "#0f172a",
  bandInk: "#ffffff",
  bandMuted: "#cbd5e1",
  good: "#16a34a",
  goodBg: "#dcfce7",
  due: "#b45309",
  dueBg: "#fef3c7",
};

/**
 * Plain "SGD 1,234.00". The PDF core fonts carry no currency glyphs beyond
 * `$`, so the ISO code is the safe way to print money — the same reason the
 * server-side receipts spell out "SGD" and "Rs.".
 */
export function moneyPdf(v: number, currency = "SGD"): string {
  return `${currency || "SGD"} ${Math.abs(Number(v) || 0).toLocaleString(
    "en-SG",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

/**
 * Invoice numbers are derived, not stored: the organizer plus the month the
 * invoice was drawn identifies it, and re-issuing the same month's invoice
 * reproduces the same number. If these ever have to be a gapless statutory
 * sequence, that wants a real counter behind an endpoint.
 */
export function invoiceNumberFor(organizerId: string, issued: Date): string {
  const ym = `${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, "0")}`;
  return `INV-${ym}-${organizerId.slice(-6).toUpperCase()}`;
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

/**
 * Builds the invoice and hands back the jsPDF document plus its number, so
 * the caller decides whether to save it, mail it or inspect it.
 *
 * The items table shows the sellable item, the quantity and the line total.
 * There is deliberately no rate column — the per-unit price is internal and
 * does not belong on a document that goes to the organizer.
 */
export async function buildOrganizerInvoice(opts: InvoiceOptions): Promise<{
  pdf: import("jspdf").jsPDF;
  invoiceNo: string;
  fileName: string;
}> {
  const { billing, company, qrDataUrl } = opts;
  const issued = opts.issued || new Date();
  const cur = billing.rates.currency || "SGD";

  // jspdf ships the class as both a named and a default export; which one a
  // dynamic import hands back depends on the bundler and the module format,
  // so take whichever is there rather than assuming.
  const mod = (await import("jspdf")) as unknown as {
    jsPDF?: typeof import("jspdf").jsPDF;
    default?: typeof import("jspdf").jsPDF;
  };
  const JsPDF = mod.jsPDF || mod.default;
  if (!JsPDF) throw new Error("jspdf failed to load");

  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const left = 40;
  const rightEdge = pageW - 40;
  const usable = rightEdge - left;

  const invoiceNo = invoiceNumberFor(billing.organizer._id, issued);
  const name = company.name || "Eventsh";
  const uen = company.uen || "";
  const settled = billing.totals.owed <= 0;

  // ── drawing helpers ────────────────────────────────────────────────────
  const fillC = (hex: string) => pdf.setFillColor(...rgb(hex));
  const strokeC = (hex: string) => pdf.setDrawColor(...rgb(hex));
  const textC = (hex: string) => pdf.setTextColor(...rgb(hex));
  const font = (weight: "normal" | "bold", size: number) =>
    pdf.setFont("helvetica", weight).setFontSize(size);

  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill?: string,
    stroke?: string,
  ) => {
    if (fill) fillC(fill);
    if (stroke) {
      strokeC(stroke);
      pdf.setLineWidth(0.6);
    }
    pdf.rect(x, y, w, h, fill && stroke ? "FD" : fill ? "F" : "S");
  };

  /** Place text inside a column box, honouring its alignment and padding. */
  const cell = (
    text: string,
    x: number,
    w: number,
    y: number,
    align: "left" | "center" | "right" = "left",
    pad = 8,
  ) => {
    const tx =
      align === "right"
        ? x + w - pad
        : align === "center"
          ? x + w / 2
          : x + pad;
    pdf.text(text, tx, y, { align });
  };

  /** Trim to whatever fits the given width in the current font. */
  const fit = (text: string, maxW: number) => {
    if (pdf.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && pdf.getTextWidth(t + "...") > maxW)
      t = t.slice(0, -1);
    return t.trimEnd() + "...";
  };

  // ── header band ────────────────────────────────────────────────────────
  box(left, 40, usable, 78, C.band);
  textC(C.bandInk);
  font("bold", 22);
  pdf.text(fit(name, usable / 2 - 20), left + 18, 68);
  font("normal", 9);
  textC(C.bandMuted);
  pdf.text("Event management platform", left + 18, 84);
  if (uen) pdf.text(`UEN ${uen}`, left + 18, 98);

  textC(C.bandInk);
  font("bold", 13);
  cell("TAX INVOICE", left, usable, 66, "right", 18);
  font("normal", 9);
  textC(C.bandMuted);
  cell(`Invoice: ${invoiceNo}`, left, usable, 84, "right", 18);
  cell(
    `Issued: ${issued.toLocaleDateString("en-SG")}`,
    left,
    usable,
    98,
    "right",
    18,
  );

  let y = 142;

  // ── billed-to + payment-details, two columns ───────────────────────────
  const colW = (usable - 12) / 2;
  const billX = left;
  const payX = left + colW + 12;
  const boxH = 86;

  font("bold", 9);
  textC(C.muted);
  pdf.text("BILLED TO", billX, y);
  pdf.text("PAYMENT DETAILS", payX, y);

  box(billX, y + 14, colW, boxH, undefined, C.line);
  box(payX, y + 14, colW, boxH, undefined, C.line);

  font("bold", 11);
  textC(C.ink);
  pdf.text(
    fit(
      billing.organizer.organizationName || billing.organizer.name || "-",
      colW - 20,
    ),
    billX + 10,
    y + 34,
  );
  font("normal", 9.5);
  textC(C.body);
  let by = y + 50;
  if (billing.organizer.name && billing.organizer.organizationName) {
    pdf.text(fit(billing.organizer.name, colW - 20), billX + 10, by);
    by += 14;
  }
  if (billing.organizer.email) {
    pdf.text(fit(billing.organizer.email, colW - 20), billX + 10, by);
    by += 14;
  }
  if (billing.organizer.country) {
    font("normal", 9);
    textC(C.muted);
    pdf.text(`Country: ${billing.organizer.country}`, billX + 10, by);
  }

  const payRows: Array<[string, string]> = [
    ["Method", "PayNow (Singapore)"],
    ...(uen ? ([["Payee UEN", uen]] as Array<[string, string]>) : []),
    ["Payable to", name],
    ["Currency", cur],
    ["Amount due", moneyPdf(billing.totals.owed, cur)],
  ];
  payRows.forEach(([k, v], i) => {
    const ry = y + 34 + i * 14;
    font("normal", 9);
    textC(C.muted);
    pdf.text(k, payX + 10, ry);
    font("bold", 9.5);
    textC(C.body);
    pdf.text(fit(v, colW - 95), payX + 85, ry);
  });

  y += 14 + boxH + 22;

  // ── items table ────────────────────────────────────────────────────────
  const cols = {
    desc: { x: left, w: usable * 0.62 },
    qty: { x: left + usable * 0.62, w: usable * 0.13 },
    amt: { x: left + usable * 0.75, w: usable * 0.25 },
  };

  font("bold", 9);
  textC(C.muted);
  pdf.text("ITEMS", left, y);
  y += 14;

  const drawTableHeader = () => {
    box(left, y, usable, 22, C.band);
    textC(C.bandInk);
    font("bold", 9);
    cell("DESCRIPTION", cols.desc.x, cols.desc.w, y + 14, "left");
    cell("QTY", cols.qty.x, cols.qty.w, y + 14, "center");
    cell("AMOUNT", cols.amt.x, cols.amt.w, y + 14, "right");
    y += 22;
  };
  drawTableHeader();

  /**
   * Break to a new page when `needed` points won't fit above the footer.
   * `repeatHeader` re-prints the banded column titles, so a reader landing on
   * page three still knows which column is which — off for the totals and
   * payment blocks, which aren't table rows.
   */
  const ensure = (needed: number, repeatHeader = false) => {
    if (y + needed > pageH - 70) {
      pdf.addPage();
      y = 50;
      if (repeatHeader) drawTableHeader();
    }
  };

  let zebra = false;
  const itemRow = (desc: string, qty: number, amount: number) => {
    ensure(24, true);
    const h = 21;
    box(left, y, usable, h, zebra ? C.zebra : "#ffffff", C.line);
    zebra = !zebra;
    font("normal", 10);
    textC(C.body);
    cell(
      fit(desc, cols.desc.w - 32),
      cols.desc.x + 12,
      cols.desc.w - 12,
      y + 14,
    );
    cell(String(qty), cols.qty.x, cols.qty.w, y + 14, "center");
    font("bold", 10);
    textC(C.ink);
    cell(moneyPdf(amount, cur), cols.amt.x, cols.amt.w, y + 14, "right");
    y += h;
  };

  /** An event (or the memberships bucket) heading its own item rows. */
  const groupRow = (title: string, date?: string) => {
    ensure(48, true);
    const h = 22;
    box(left, y, usable, h, "#eef2f7", C.line);
    font("bold", 10);
    textC(C.ink);
    let dateW = 0;
    if (date) {
      font("normal", 9);
      dateW = pdf.getTextWidth(date) + 14;
      font("bold", 10);
    }
    const shown = fit(title, cols.desc.w + cols.qty.w - dateW - 24);
    pdf.text(shown, cols.desc.x + 8, y + 15);
    // Width has to be taken here, in the bold heading font — measuring after
    // switching to the smaller date font under-reads it, and the date lands
    // on top of the last few characters of the title.
    const titleEnd = cols.desc.x + 8 + pdf.getTextWidth(shown);
    if (date) {
      font("normal", 9);
      textC(C.muted);
      pdf.text(date, titleEnd + 14, y + 15);
    }
    y += h;
    zebra = false;
  };

  let anyLine = false;
  for (const ev of billing.events) {
    const charged: Array<[string, number, number]> = (
      [
        ["Booked stalls", ev.stallsSold, billing.rates.stall],
        ["Booked round tables", ev.tablesBooked, billing.rates.roundTable],
        ["Booked chairs", ev.chairsBooked, billing.rates.chair],
        ["Confirmed speakers", ev.speakersBooked, billing.rates.speaker],
      ] as Array<[string, number, number]>
    ).filter(([, qty]) => qty > 0);
    if (charged.length === 0) continue;
    anyLine = true;

    groupRow(
      ev.title || "Event",
      new Date(ev.startDate).toLocaleDateString("en-SG"),
    );
    for (const [label, qty, rate] of charged) itemRow(label, qty, qty * rate);
  }

  if (billing.memberships && billing.memberships.active > 0) {
    anyLine = true;
    groupRow("Exhibitor memberships");
    itemRow(
      "Active memberships",
      billing.memberships.active,
      billing.memberships.amount,
    );
  }

  if (!anyLine) {
    ensure(26, true);
    box(left, y, usable, 24, "#ffffff", C.line);
    font("normal", 10);
    textC(C.muted);
    pdf.text("Nothing billable yet.", cols.desc.x + 12, y + 16);
    y += 24;
  }

  // ── totals ─────────────────────────────────────────────────────────────
  const totalRow = (
    label: string,
    value: number,
    opt: { strong?: boolean } = {},
  ) => {
    const h = opt.strong ? 28 : 22;
    ensure(h + 4);
    box(left, y, usable, h, opt.strong ? C.zebra : "#ffffff", C.line);
    font("bold", opt.strong ? 10.5 : 9.5);
    textC(opt.strong ? C.ink : C.muted);
    cell(
      opt.strong ? "AMOUNT DUE" : label,
      cols.desc.x,
      cols.desc.w + cols.qty.w,
      y + (opt.strong ? 19 : 15),
      "right",
    );
    font("bold", opt.strong ? 13 : 10);
    textC(C.ink);
    cell(
      moneyPdf(value, cur),
      cols.amt.x,
      cols.amt.w,
      y + (opt.strong ? 19 : 15),
      "right",
    );
    y += h;
  };
  totalRow("SUBTOTAL", billing.totals.billable);
  totalRow("PAYMENTS RECEIVED", billing.totals.paid);
  totalRow("AMOUNT DUE", billing.totals.owed, { strong: true });
  y += 16;

  // ── how to pay ─────────────────────────────────────────────────────────
  const payH = 126;
  ensure(payH + 10);
  box(left, y, usable, payH, C.zebra, C.line);

  font("bold", 9);
  textC(C.muted);
  pdf.text("HOW TO PAY", left + 14, y + 20);

  // Status pill, mirroring the receipt's active/expired pill.
  const pillLabel = settled ? "PAID IN FULL" : "PAYMENT DUE";
  font("bold", 8.5);
  const pillW = pdf.getTextWidth(pillLabel) + 22;
  const pillX = rightEdge - pillW - 14;
  fillC(settled ? C.goodBg : C.dueBg);
  pdf.roundedRect(pillX, y + 9, pillW, 18, 9, 9, "F");
  textC(settled ? C.good : C.due);
  pdf.text(pillLabel, pillX + pillW / 2, y + 21, { align: "center" });

  pdf.addImage(qrDataUrl, "PNG", left + 14, y + 28, 88, 88);

  const tx = left + 118;
  let ty = y + 44;
  font("normal", 10);
  textC(C.body);
  pdf.text("Scan with any PayNow-enabled bank app.", tx, ty);
  ty += 18;
  const payLine = (k: string, v: string) => {
    font("normal", 9);
    textC(C.muted);
    pdf.text(k, tx, ty);
    font("bold", 9.5);
    textC(C.ink);
    pdf.text(v, tx + 78, ty);
    ty += 14;
  };
  if (uen) payLine("PayNow UEN", uen);
  payLine("Payable to", name);
  payLine("Reference", invoiceNo);
  ty += 4;
  font("normal", 8.5);
  textC(C.muted);
  pdf.text(
    "This QR carries no amount — enter the amount due when paying.",
    tx,
    ty,
  );
  pdf.text("It stays valid for part payments.", tx, ty + 11);

  y += payH;

  // ── footer, on every page ──────────────────────────────────────────────
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    strokeC(C.line);
    pdf.setLineWidth(0.6);
    pdf.line(left, pageH - 46, rightEdge, pageH - 46);
    font("normal", 8);
    textC(C.muted);
    pdf.text(
      `${name}${uen ? ` · UEN ${uen}` : ""} · ${invoiceNo} · Generated ${issued.toLocaleString("en-SG")}`,
      left,
      pageH - 32,
    );
    cell(`Page ${p} of ${pages}`, left, usable, pageH - 32, "right", 0);
  }

  const safe = (
    billing.organizer.organizationName ||
    billing.organizer.name ||
    "organizer"
  ).replace(/[^a-z0-9]+/gi, "_");

  return { pdf, invoiceNo, fileName: `${invoiceNo}-${safe}.pdf` };
}
