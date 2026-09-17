// Operator referral attribution (referralCode / referralOperatorId /
// referralOperatorName) is organizer-dashboard-only. The public create
// endpoints hand the saved booking back to the visitor/vendor/speaker, so
// strip those fields from that copy. The stored document keeps them.
const REFERRAL_FIELDS = [
  "referralCode",
  "referralOperatorId",
  "referralOperatorName",
] as const;

export function omitReferralFields<T>(doc: T): T {
  if (!doc || typeof doc !== "object") return doc;
  const plain: any =
    typeof (doc as any).toJSON === "function"
      ? (doc as any).toJSON()
      : { ...(doc as any) };
  for (const field of REFERRAL_FIELDS) delete plain[field];
  return plain;
}
