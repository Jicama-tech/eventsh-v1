/**
 * The super-admin's platform-fee invoice: what an organizer owes Eventsh.
 *
 * Kept out of the dialog component so the layout can be exercised on its own
 * (it is hand-positioned jsPDF, which is easy to break silently) and so the
 * jspdf bundle only loads when someone actually asks for an invoice — the
 * caller imports this module lazily.
 */

/** Only the parts of the super-admin billing payload the invoice reads. */
export interface InvoiceBilling {
  organizer: {
    _id: string;
    name?: string;
    organizationName?: string;
    email?: string;
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

/**
 * Plain "SGD 1,234.00". jsPDF's core fonts carry no currency glyphs beyond
 * `$`, so the ISO code is the safe way to print money in the PDF.
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

/**
 * Builds the invoice and hands back the jsPDF document plus its number, so
 * the caller decides whether to save it, mail it or inspect it.
 *
 * Every charged component gets its own line: one figure per event would hide
 * four different rates behind a single number, which is not something the
 * organizer can check. The QR is the static one — a filed invoice outlives
 * the amount it was drawn for, so an amount-locked QR would go stale.
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
  const left = 48;
  const right = pageW - 48;
  const invoiceNo = invoiceNumberFor(billing.organizer._id, issued);
  const name = company.name || "Eventsh";
  const uen = company.uen || "";
  let y = 60;

  // Item, quantity, line total. There is deliberately no rate column: the
  // per-unit price is internal pricing, and the organizer only needs to see
  // what they are being charged for, how many, and what it comes to.
  const colQty = right - 150;

  const drawColumnHeader = () => {
    pdf.setFont("helvetica", "bold").setFontSize(8).setTextColor(120);
    pdf.text("DESCRIPTION", left, y);
    pdf.text("QTY", colQty, y, { align: "right" });
    pdf.text("AMOUNT", right, y, { align: "right" });
    pdf.setTextColor(0);
    y += 8;
    pdf.setDrawColor(200).line(left, y, right, y);
    y += 16;
  };

  /**
   * Break to a new page when `needed` points won't fit above the footer.
   * `repeatHeader` re-prints the column titles, so a reader landing on page
   * three still knows which column is which — it is off for the totals and
   * payment blocks, which aren't table rows.
   */
  const ensure = (needed: number, repeatHeader = false) => {
    if (y + needed > pageH - 90) {
      pdf.addPage();
      y = 60;
      if (repeatHeader) drawColumnHeader();
    }
  };

  // ── Header: who is billing, and under which registration ──
  pdf.setFontSize(20).setFont("helvetica", "bold");
  pdf.text("TAX INVOICE", left, y);
  pdf.setFontSize(12);
  pdf.text(name, right, y, { align: "right" });
  y += 16;
  pdf.setFontSize(9).setFont("helvetica", "normal").setTextColor(110);
  if (uen) pdf.text(`UEN ${uen}`, right, y, { align: "right" });
  y += 12;
  pdf.text(`All amounts in ${cur}`, right, y, { align: "right" });
  pdf.setTextColor(0);
  y += 30;

  // ── Bill-to and invoice meta, side by side ──
  const metaX = right - 165;
  pdf.setFontSize(8).setFont("helvetica", "bold").setTextColor(120);
  pdf.text("BILL TO", left, y);
  pdf.text("INVOICE", metaX, y);
  pdf.setTextColor(0);
  y += 15;
  pdf.setFont("helvetica", "bold").setFontSize(10.5);
  pdf.text(
    billing.organizer.organizationName || billing.organizer.name || "Organizer",
    left,
    y,
  );
  pdf.setFont("helvetica", "normal").setFontSize(9);
  pdf.text(`No.     ${invoiceNo}`, metaX, y);
  y += 14;
  pdf.setFontSize(9);
  if (billing.organizer.name && billing.organizer.organizationName) {
    pdf.setTextColor(110);
    pdf.text(billing.organizer.name, left, y);
    pdf.setTextColor(0);
  }
  pdf.text(`Date    ${issued.toLocaleDateString("en-SG")}`, metaX, y);
  y += 14;
  if (billing.organizer.email) {
    pdf.setTextColor(110);
    pdf.text(billing.organizer.email, left, y);
    pdf.setTextColor(0);
  }
  y += 30;

  // ── Line items ──
  drawColumnHeader();

  const lineItem = (desc: string, qty: number, rate: number) => {
    ensure(18, true);
    pdf.setFont("helvetica", "normal").setFontSize(9);
    pdf.text(desc.slice(0, 64), left + 12, y);
    pdf.text(String(qty), colQty, y, { align: "right" });
    pdf.text(moneyPdf(qty * rate, cur), right, y, { align: "right" });
    y += 15;
  };

  /** Trim to whatever fits the given width in the current font. */
  const fit = (text: string, maxW: number) => {
    if (pdf.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && pdf.getTextWidth(t + "...") > maxW)
      t = t.slice(0, -1);
    return t.trimEnd() + "...";
  };

  /**
   * Event name plus its date. The name is measured and trimmed to leave room
   * for the date — slicing the whole string to a fixed length instead would
   * eat the date on a long title, which is exactly the bit you need to tell
   * two roadshow legs apart.
   */
  const groupHeading = (title: string, date?: string) => {
    ensure(32, true);
    pdf.setFont("helvetica", "bold").setFontSize(9.5);
    let dateW = 0;
    if (date) {
      pdf.setFont("helvetica", "normal").setFontSize(8.5);
      dateW = pdf.getTextWidth(date) + 12;
      pdf.setFont("helvetica", "bold").setFontSize(9.5);
    }
    const shown = fit(title, colQty - left - dateW - 10);
    pdf.text(shown, left, y);
    if (date) {
      const afterTitle = left + pdf.getTextWidth(shown) + 12;
      pdf.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(120);
      pdf.text(date, afterTitle, y);
      pdf.setTextColor(0);
    }
    y += 15;
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

    groupHeading(
      ev.title || "Event",
      new Date(ev.startDate).toLocaleDateString("en-SG"),
    );
    for (const [label, qty, rate] of charged) lineItem(label, qty, rate);
    y += 5;
  }

  if (billing.memberships && billing.memberships.active > 0) {
    anyLine = true;
    groupHeading("Exhibitor memberships");
    lineItem(
      "Active memberships",
      billing.memberships.active,
      billing.rates.membership,
    );
    y += 5;
  }

  if (!anyLine) {
    pdf.setFont("helvetica", "italic").setFontSize(9).setTextColor(120);
    pdf.text("Nothing billable yet.", left + 12, y);
    pdf.setTextColor(0);
    y += 20;
  }

  // ── Totals ──
  // Labels sit just left of the amounts, clear of the QTY column.
  const totalsLabelX = right - 100;
  const totalsRuleX = right - 260;
  ensure(100);
  pdf.setDrawColor(200).line(totalsRuleX, y, right, y);
  y += 18;
  const totalRow = (label: string, value: number, bold = false) => {
    pdf
      .setFont("helvetica", bold ? "bold" : "normal")
      .setFontSize(bold ? 11 : 9.5);
    pdf.text(label, totalsLabelX, y, { align: "right" });
    pdf.text(moneyPdf(value, cur), right, y, { align: "right" });
    y += bold ? 22 : 16;
  };
  totalRow("Subtotal", billing.totals.billable);
  totalRow("Payments received", billing.totals.paid);
  pdf.setDrawColor(150).line(totalsRuleX, y - 7, right, y - 7);
  y += 7;
  totalRow("Amount due", billing.totals.owed, true);

  // ── How to pay ──
  ensure(200);
  y += 14;
  pdf.setFont("helvetica", "bold").setFontSize(11);
  pdf.text("How to pay", left, y);
  y += 16;
  pdf.addImage(qrDataUrl, "PNG", left, y, 116, 116);
  const tx = left + 134;
  let ty = y + 18;
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  pdf.text("Scan with any PayNow-enabled bank app.", tx, ty);
  ty += 17;
  if (uen) {
    pdf.text(`PayNow UEN      ${uen}`, tx, ty);
    ty += 15;
  }
  pdf.text(`Payable to      ${name}`, tx, ty);
  ty += 15;
  pdf.text(`Reference       ${invoiceNo}`, tx, ty);
  ty += 17;
  pdf.setTextColor(110).setFontSize(8.5);
  pdf.text("This QR carries no amount — enter the amount due", tx, ty);
  ty += 11;
  pdf.text("when paying. It stays valid for part payments.", tx, ty);
  pdf.setTextColor(0);
  y += 132;

  pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(140);
  pdf.text(
    `${name}${uen ? ` · UEN ${uen}` : ""} · Generated ${issued.toLocaleString("en-SG")}`,
    left,
    pageH - 36,
  );
  pdf.setTextColor(0);

  const safe = (
    billing.organizer.organizationName ||
    billing.organizer.name ||
    "organizer"
  ).replace(/[^a-z0-9]+/gi, "_");

  return { pdf, invoiceNo, fileName: `${invoiceNo}-${safe}.pdf` };
}
