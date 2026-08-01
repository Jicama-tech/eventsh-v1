import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { buildPayNowQrUrl } from "@/lib/paynowQr";
import { COUNTRIES } from "@/data/countries";
import {
  Loader2,
  Handshake,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Upload,
  QrCode,
} from "lucide-react";

const apiURL = __API_URL__;

interface Tier {
  id: string;
  name: string;
  price: number;
  description?: string;
}

function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

type Step = "tiers" | "auth" | "form" | "pay" | "done";

/** Inline Google "G" mark — no external asset, CSP-safe. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/**
 * "Become a Sponsor" — the whole flow in one popup, mirroring the
 * Become-a-member dialog:
 *   tiers → details form → dynamic QR payment → transaction proof → done.
 *
 * The organizer verifies the payment from their dashboard, which is what
 * confirms the sponsorship and triggers the invoice email.
 */
export default function EventfrontSponsorDialog({
  open,
  onClose,
  eventId,
  organizerId,
  primaryColor = "#f97316",
}: {
  open: boolean;
  onClose: () => void;
  eventId?: string;
  organizerId?: string;
  primaryColor?: string;
}) {
  const [step, setStep] = useState<Step>("tiers");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [currency, setCurrency] = useState("IN");
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier | null>(null);

  // Applicant details
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Payment
  const [organizer, setOrganizer] = useState<any>(null);
  const [transactionId, setTransactionId] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [paying, setPaying] = useState(false);

  // Google sign-in gate. The verified address is the sponsor's identity —
  // it keys their application and is one of the two invoice recipients.
  const [googleLoading, setGoogleLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // Reset everything when the dialog is dismissed so a second visit starts
  // clean rather than resuming a half-finished application.
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setStep("tiers");
      setTier(null);
      setCompanyName("");
      setContactName("");
      setEmail("");
      setBusinessEmail("");
      setPhone("");
      setWebsite("");
      setMessage("");
      setLogoFile(null);
      setLogoPreview("");
      setTransactionId("");
      setProof(null);
    }, 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiURL}/sponsors/tiers/${eventId}`);
        const j = res.ok ? await res.json() : null;
        if (cancelled) return;
        setTiers(Array.isArray(j?.data?.tiers) ? j.data.tiers : []);
        setCurrency(j?.data?.currency || "IN");
      } catch {
        if (!cancelled) setTiers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  // The organizer's payment details drive the QR (same source the stall and
  // round-table payment pages use).
  useEffect(() => {
    if (!open || !organizerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiURL}/organizers/profile-get/${organizerId}`);
        const j = res.ok ? await res.json() : null;
        if (!cancelled && j?.data) setOrganizer(j.data);
      } catch {
        // Non-fatal — the pay step falls back to "not configured".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizerId]);

  // Open the Google OAuth popup (same backend flow the supplier quotation
  // form and the Become-a-member dialog use).
  const handleGoogleLogin = () => {
    const w = 480;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      `${apiURL}/auth/google-member`,
      "eventsh-google-member",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    setGoogleLoading(true);
  };

  // Profile arrives via postMessage + a polled localStorage handshake
  // (dual-channel, matching EventfrontGoogleMemberCallback).
  useEffect(() => {
    if (!googleLoading) return;
    const KEY = "eventsh:google-member";
    const prev = (() => {
      try {
        return localStorage.getItem(KEY) || "";
      } catch {
        return "";
      }
    })();
    let handled = false;
    let sawPopupClosed = false;

    const accept = (raw: string, name?: string) => {
      const clean = String(raw || "").trim().toLowerCase();
      setGoogleLoading(false);
      if (!clean) {
        toast({
          variant: "destructive",
          title: "Sign-in failed",
          description: "Couldn't read your Google email.",
        });
        return;
      }
      setEmail(clean);
      if (name && !contactName) setContactName(name);
      setStep("form");
    };

    const onMessage = (ev: MessageEvent) => {
      const d = ev?.data;
      if (!d || d.kind !== "eventsh:google-member" || handled) return;
      handled = true;
      accept(d.email || "", d.name);
    };
    window.addEventListener("message", onMessage);

    const t = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && raw !== prev && !handled) {
          handled = true;
          window.clearInterval(t);
          localStorage.removeItem(KEY);
          const parsed = JSON.parse(raw);
          accept(parsed?.email || "", parsed?.name);
          return;
        }
      } catch {
        // ignore
      }
      if (popupRef.current && popupRef.current.closed && !handled) {
        if (sawPopupClosed) {
          window.clearInterval(t);
          setGoogleLoading(false);
        } else {
          sawPopupClosed = true;
        }
      }
    }, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLoading]);

  const pickLogo = (f: File | null) => {
    setLogoFile(f);
    setLogoPreview((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : "";
    });
  };

  // Submit the application, then move to payment (or straight to done for a
  // free package).
  const submitApplication = async () => {
    if (!tier || !eventId) return;
    if (!companyName.trim() || !contactName.trim() || !email.trim()) {
      toast({
        variant: "destructive",
        title: "Company, contact name and email are required",
      });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("eventId", eventId);
      fd.append("sponsorTypeId", tier.id);
      fd.append("companyName", companyName.trim());
      fd.append("contactName", contactName.trim());
      fd.append("email", email.trim().toLowerCase());
      if (businessEmail.trim())
        fd.append("businessEmail", businessEmail.trim().toLowerCase());
      fd.append("countryCode", countryCode);
      fd.append("phone", phone.trim());
      fd.append("website", website.trim());
      fd.append("message", message.trim());
      if (logoFile) fd.append("logo", logoFile);

      const res = await fetch(`${apiURL}/sponsors/apply`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Submission failed");
      setStep(tier.price > 0 ? "pay" : "done");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't submit",
        description: e?.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // "I have paid" — attach the reference + screenshot for the organizer.
  const submitPayment = async () => {
    if (!eventId) return;
    if (!transactionId.trim() && !proof) {
      toast({
        variant: "destructive",
        title: "Add a transaction ID or a payment screenshot",
      });
      return;
    }
    setPaying(true);
    try {
      const fd = new FormData();
      if (transactionId.trim()) fd.append("transactionId", transactionId.trim());
      fd.append("paymentMethod", "qr");
      if (proof) fd.append("transactionScreenshot", proof);
      const res = await fetch(
        `${apiURL}/sponsors/event/${eventId}/my-application/${encodeURIComponent(
          email.trim().toLowerCase(),
        )}/payment`,
        { method: "POST", body: fd },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Could not submit the payment");
      setStep("done");
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't submit the payment",
        description: e?.message,
      });
    } finally {
      setPaying(false);
    }
  };

  // ── Payment QR ────────────────────────────────────────────────────
  // Singapore gets a true dynamic PayNow QR with the amount baked in.
  // India falls back to the organizer's uploaded QR image (their UPI id
  // isn't stored separately), with the amount shown alongside.
  const amount = tier?.price || 0;
  const orgCountry = organizer?.country || currency;
  const payNowUrl =
    orgCountry === "SG"
      ? buildPayNowQrUrl({
          organizer: {
            UENNumber: organizer?.UENNumber,
            payNowId: organizer?.payNowId || organizer?.phone,
          },
          amount,
          company: organizer?.organizationName,
        })
      : null;
  const staticQrImage = organizer?.paymentURL || "";

  const heading =
    step === "tiers"
      ? "Become a Sponsor"
      : step === "auth"
        ? "Sign in to continue"
        : step === "form"
        ? "Your details"
        : step === "pay"
          ? "Complete your payment"
          : "All done";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" style={{ color: primaryColor }} />
            {heading}
          </DialogTitle>
          <DialogDescription>
            {step === "tiers" &&
              "Put your brand in front of everyone at this event. Pick the package that suits you."}
            {step === "auth" &&
              "We use your Google account to verify your email and keep your sponsorship details for next time."}
            {step === "form" &&
              tier &&
              `${tier.name} · ${tier.price === 0 ? "Free" : money(tier.price, currency)}`}
            {step === "pay" &&
              `Scan the QR and pay ${money(amount, currency)}, then confirm below.`}
            {step === "done" && "Thanks — we've passed this to the organizer."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 flex-1 space-y-3 overflow-y-auto pr-2">
          {/* ── STEP 1: packages ── */}
          {step === "tiers" &&
            (loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : tiers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No sponsorship packages are published yet. Check back soon.
              </div>
            ) : (
              tiers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTier(t);
                    setStep(email ? "form" : "auth");
                  }}
                  className="flex w-full flex-col gap-1 rounded-xl border-2 bg-white p-3 text-left transition hover:shadow-md"
                  style={{ borderColor: `${primaryColor}55` }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="font-bold" style={{ color: primaryColor }}>
                      {t.name}
                    </span>
                    <span className="ml-auto text-lg font-bold">
                      {t.price === 0 ? "Free" : money(t.price, currency)}
                    </span>
                  </div>
                  {t.description && (
                    <div className="whitespace-pre-line text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  )}
                  <div
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"
                    style={{ color: primaryColor }}
                  >
                    Choose this package <ArrowRight className="h-3 w-3" />
                  </div>
                </button>
              ))
            ))}

          {/* ── STEP 1b: Google gate ── */}
          {step === "auth" && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Signing in with Google confirms your email address, so your
                invoice reaches the right inbox and we can prefill your details
                if you sponsor again.
              </p>
              <Button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                variant="outline"
                size="lg"
                className="w-full"
              >
                {googleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <GoogleG className="mr-2 h-5 w-5" />
                )}
                {googleLoading ? "Waiting for Google…" : "Sign in with Google"}
              </Button>
            </div>
          )}

          {/* ── STEP 2: details ── */}
          {step === "form" && (
            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Company name *</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Contact person *</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">
                  Email (verified with Google)
                </Label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted/50"
                  title="Verified via Google sign-in — can't be changed"
                />
              </div>
              <div>
                <Label className="text-xs">Company email</Label>
                <Input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="accounts@company.com"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  The invoice PDF goes to both addresses.
                </p>
              </div>
              <div>
                <Label className="text-xs">Contact number</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-32 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    {/* Sponsors can be anywhere — full country list. */}
                    <SelectContent className="max-h-64">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.dialCode}>
                          {c.flag} {c.dialCode} {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div>
                <Label className="text-xs">Company logo</Label>
                <div className="mt-1 flex items-center gap-3">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-14 w-14 rounded border bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded border bg-muted/30">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    className="flex-1"
                    onChange={(e) => pickLogo(e.target.files?.[0] || null)}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Shown on the event page once your sponsorship is confirmed.
                </p>
              </div>
              <div>
                <Label className="text-xs">Message (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Anything the organizer should know."
                />
              </div>
            </div>
          )}

          {/* ── STEP 3: pay ── */}
          {step === "pay" && (
            <div className="space-y-3">
              <div className="rounded-xl border p-3 text-center">
                <div className="text-xs text-muted-foreground">Amount due</div>
                <div className="text-2xl font-bold">
                  {money(amount, currency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tier?.name}
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/20 p-4">
                {payNowUrl ? (
                  <img
                    src={payNowUrl}
                    alt="PayNow QR"
                    className="h-52 w-52 rounded bg-white object-contain p-2"
                  />
                ) : staticQrImage ? (
                  <img
                    src={
                      /^https?:\/\//.test(staticQrImage)
                        ? staticQrImage
                        : `${apiURL}${staticQrImage}`
                    }
                    alt="Payment QR"
                    className="h-52 w-52 rounded bg-white object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                    <QrCode className="h-8 w-8" />
                    The organizer hasn't set up a payment QR yet. Contact them
                    to arrange payment, then confirm below.
                  </div>
                )}
                {payNowUrl && (
                  <p className="text-[11px] text-muted-foreground">
                    Amount is pre-filled in the QR.
                  </p>
                )}
              </div>

              <div>
                <Label className="text-xs">Transaction ID / reference</Label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="UTR / transaction reference"
                />
              </div>
              <div>
                <Label className="text-xs">
                  Payment screenshot (image or PDF)
                </Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setProof(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          )}

          {/* ── STEP 4: done ── */}
          {step === "done" && (
            <div className="space-y-3 py-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <p className="font-semibold">
                {amount > 0
                  ? "Payment submitted"
                  : "Application submitted"}
              </p>
              <p className="text-sm text-muted-foreground">
                {amount > 0
                  ? "The organizer will verify your payment and email your sponsorship invoice to "
                  : "The organizer will review your application and get back to you at "}
                <strong>{email}</strong>.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        {step === "auth" && (
          <div className="flex shrink-0 gap-2 border-t pt-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setStep("tiers")}
              disabled={googleLoading}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to packages
            </Button>
          </div>
        )}

        {step !== "tiers" && step !== "auth" && (
          <div className="flex shrink-0 gap-2 border-t pt-3">
            {step === "form" && (
              <>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("tiers")}
                  disabled={submitting}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" /> Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={submitApplication}
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {tier && tier.price > 0 ? "Continue to payment" : "Submit"}
                </Button>
              </>
            )}
            {step === "pay" && (
              <Button
                className="w-full"
                onClick={submitPayment}
                disabled={paying}
              >
                {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                I have paid
              </Button>
            )}
            {step === "done" && (
              <Button className="w-full" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
