export type PaymentScheme = "UPI" | "PAYNOW";

export interface PaymentQrConfig {
  scheme: PaymentScheme;
  payeeId: string; // e.g. VPA for UPI, UEN/Mobile for PayNow
  payeeName: string;
  countryCode: string; // "IN" for UPI, "SG" for PayNow
  currency: string; // e.g. INR, SGD
  amount: string; // formatted decimal, e.g. "12.50"
  billNumber?: string;
  editableAmount?: boolean;
  /**
   * Build a *static* QR: point-of-initiation "11", no amount field, payer
   * types the sum in their bank app. Used for the invoice QR, which has to
   * keep working after the PDF is filed away — a dynamic QR carries a fixed
   * amount (and, in some wallets, an expiry) and goes stale. When set,
   * `amount` is ignored and may be omitted.
   */
  staticQr?: boolean;
}
