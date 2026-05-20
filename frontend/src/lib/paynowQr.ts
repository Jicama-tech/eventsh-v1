/**
 * Builds the sgqrcode.com PayNow QR URL used everywhere we accept Singapore
 * PayNow payments (ticket purchases, table/round-table bookings, kiosk walk-ins,
 * inline chatbot walk-ins).
 *
 * Selection rule:
 *   - If the organizer has set `UENNumber`, the QR pays the corporate proxy
 *     (uen=...) — preferred whenever available.
 *   - Otherwise we fall back to the organizer's `payNowId` mobile proxy
 *     (mobile=...) so legacy setups keep working.
 *   - If neither is set, returns `null` — callers should render their existing
 *     "PayNow not configured" path instead of generating a broken QR.
 */
export interface BuildPayNowQrInput {
  organizer: {
    UENNumber?: string | null;
    payNowId?: string | null;
  };
  amount: number | string;
  /** When the QR should stop working. Defaults to "now + 90 hours". */
  expiry?: Date;
  refId?: string;
  company?: string;
  /** Whether the payer can edit the amount in their bank app. */
  editable?: boolean;
}

function formatExpiry(d: Date): string {
  // Format: YYYY/MM/DD HH:mm (sgqrcode requirement — matches what each
  // call-site was computing inline before this helper landed)
  return (
    d.getFullYear() +
    "/" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(d.getDate()).padStart(2, "0") +
    " " +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

/** Strip spaces and a leading `+`. PayNow mobile proxies are the digits. */
function cleanMobile(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, "")
    .replace(/^\+/, "");
}

/** Strip spaces and uppercase the letter — the sgqrcode endpoint is lenient
 *  but matching canonical PayNow corporate format keeps things tidy. */
function cleanUen(raw: string): string {
  return String(raw || "").replace(/\s+/g, "").toUpperCase();
}

export function buildPayNowQrUrl(
  input: BuildPayNowQrInput,
): string | null {
  const uen = cleanUen(input.organizer?.UENNumber || "");
  const mobile = cleanMobile(input.organizer?.payNowId || "");
  if (!uen && !mobile) return null;

  const expiry = input.expiry || new Date(Date.now() + 90 * 60 * 60 * 1000);
  const encodedExpiry = encodeURIComponent(formatExpiry(expiry));
  const editableFlag = input.editable ? "1" : "0";
  const amountStr = String(input.amount ?? "");
  const refId = encodeURIComponent(input.refId || "");
  const company = encodeURIComponent(input.company || "");

  // UEN wins when set. Otherwise mobile proxy. The empty slot stays empty
  // — sgqrcode treats blank values as "use the other one".
  const mobileParam = uen ? "" : mobile;
  const uenParam = uen;

  return (
    `https://www.sgqrcode.com/paynow` +
    `?mobile=${mobileParam}` +
    `&uen=${uenParam}` +
    `&editable=${editableFlag}` +
    `&amount=${amountStr}` +
    `&expiry=${encodedExpiry}` +
    `&ref_id=${refId}` +
    `&company=${company}`
  );
}

/** Human-readable description of which payee proxy this QR will hit. Useful
 *  for "Paying to UEN 200012345A" / "Paying to +65 9003 7950" sublines under
 *  the rendered QR. */
export function describePayNowPayee(organizer: {
  UENNumber?: string | null;
  payNowId?: string | null;
}): string | null {
  const uen = cleanUen(organizer?.UENNumber || "");
  if (uen) return `UEN ${uen}`;
  const mobile = cleanMobile(organizer?.payNowId || "");
  if (mobile) {
    // Pretty-print +65 mobiles. Leave others alone.
    if (mobile.length === 10 && mobile.startsWith("65")) {
      return `+65 ${mobile.slice(2, 6)} ${mobile.slice(6)}`;
    }
    return `+${mobile}`;
  }
  return null;
}
