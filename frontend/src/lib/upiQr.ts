import QRCodeLib from "qrcode";

/**
 * Builds a UPI deep-link (`upi://pay?...`) and renders it client-side as a
 * QR data URL. UPI has no equivalent to PayNow's sgqrcode.com renderer, so
 * every caller used to hand-build this string inline — this is the shared
 * version for new code (existing call sites are left as-is, see
 * buildPayNowQrUrl in paynowQr.ts for the PayNow counterpart).
 */
export interface BuildUpiQrInput {
  payeeVpa: string;
  payeeName: string;
  amount: number | string;
  currency: string;
  note?: string;
  refId?: string;
}

export function buildUpiUri(input: BuildUpiQrInput): string {
  const amountStr =
    typeof input.amount === "number" ? input.amount.toFixed(2) : String(input.amount);
  return (
    `upi://pay?pa=${encodeURIComponent(input.payeeVpa)}` +
    `&pn=${encodeURIComponent(input.payeeName)}` +
    `&am=${amountStr}` +
    `&cu=${input.currency}` +
    (input.note ? `&tn=${encodeURIComponent(input.note)}` : "") +
    (input.refId ? `&tr=${encodeURIComponent(input.refId)}` : "")
  );
}

export async function buildUpiQrDataUrl(input: BuildUpiQrInput): Promise<{
  uri: string;
  dataUrl: string;
}> {
  const uri = buildUpiUri(input);
  const dataUrl = await QRCodeLib.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 6,
  });
  return { uri, dataUrl };
}
