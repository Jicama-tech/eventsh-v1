import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  Send,
  AlertCircle,
  Handshake,
  Building2,
  Wallet,
  Clock,
  Paperclip,
  Upload,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";

const apiURL = __API_URL__;

// Same two-country convention used across the organizer CRM.
const SUPPORTED_COUNTRIES = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
];

// Inline Google "G" mark for the sign-in button (no external asset / CSP-safe).
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

interface Tier {
  id: string;
  name: string;
  price: number;
  description?: string;
  // When false, this tier isn't paid — pick from `customOptions` instead, up
  // to the value of `price` (shown to sponsors the same way a price is).
  collectPayment?: boolean;
  customOptions?: string[];
}
interface TiersData {
  tiers: Tier[];
  currency: string;
  event: {
    id: string;
    title: string;
    startDate?: string;
    location?: string;
  } | null;
}

function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

const STATUS_STYLES: Record<string, string> = {
  Applied: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  "Payment Submitted": "bg-purple-100 text-purple-700",
  Confirmed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-stone-200 text-stone-600",
};

function statusBlurb(status: string): string {
  switch (status) {
    case "Approved":
      return "You're approved 🎉 Complete the payment below to confirm your sponsorship.";
    case "Payment Submitted":
      return "Thanks — we've passed your payment details to the organizer. They'll verify and confirm shortly.";
    case "Confirmed":
      return "Your sponsorship is confirmed. Thank you for supporting this event!";
    case "Rejected":
      return "Unfortunately the organizer couldn't accept this application.";
    case "Cancelled":
      return "This application was cancelled.";
    default:
      return "Your application has been submitted and is awaiting the organizer's review.";
  }
}

/**
 * Public "Become a sponsor" page. Gated by Google sign-in (same pattern as the
 * supplier quotation form) — the verified email is both the dedupe key and how
 * a sponsor safely returns later to pay once they've been approved.
 */
export default function SponsorApplicationForm() {
  const { id: eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<TiersData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // 1 = pick a tier, 2 = your business
  const [step, setStep] = useState(1);

  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  // Set when this email already applied — we show the status page instead.
  const [myApp, setMyApp] = useState<any | null>(null);

  // Application fields
  const [tierId, setTierId] = useState("");
  // Which of the chosen (non-cash) tier's custom options the sponsor picked.
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [countryCode, setCountryCode] = useState(
    SUPPORTED_COUNTRIES[0].dialCode,
  );
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  // Payment step
  const [payBusy, setPayBusy] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [proof, setProof] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiURL}/sponsors/tiers/${eventId}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j?.message || "This page isn't available.");
        setData(j.data);
        // Arrived from the eventfront "Become a Sponsor" popup with a package
        // already chosen — preselect it so they don't pick twice.
        const wanted = new URLSearchParams(window.location.search).get("tier");
        if (wanted && (j.data?.tiers || []).some((t: Tier) => t.id === wanted)) {
          setTierId(wanted);
        }
      } catch (e: any) {
        setLoadError(e?.message || "This page isn't available.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

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

  // Once the Google email is verified, check whether they already applied.
  const onSignedIn = async (rawEmail: string) => {
    const clean = String(rawEmail || "").trim().toLowerCase();
    if (!clean) {
      setGoogleLoading(false);
      toast({
        variant: "destructive",
        title: "Sign-in failed",
        description: "Couldn't read your Google email.",
      });
      return;
    }
    setAuthedEmail(clean);
    try {
      const res = await fetch(
        `${apiURL}/sponsors/event/${eventId}/my-application/${encodeURIComponent(clean)}`,
      );
      const j = res.ok ? await res.json() : { data: null };
      if (j?.data) setMyApp(j.data);
    } catch {
      // Non-fatal — they can still fill the form.
    } finally {
      setGoogleLoading(false);
    }
  };

  const refreshMyApp = async () => {
    if (!authedEmail) return;
    try {
      const res = await fetch(
        `${apiURL}/sponsors/event/${eventId}/my-application/${encodeURIComponent(authedEmail)}`,
      );
      const j = res.ok ? await res.json() : { data: null };
      if (j?.data) setMyApp(j.data);
    } catch {
      /* keep the last-known state */
    }
  };

  // Google profile arrives via postMessage + a polled localStorage handshake
  // (dual-channel, matching the supplier form).
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

    const onMessage = (ev: MessageEvent) => {
      const d = ev?.data;
      if (!d || d.kind !== "eventsh:google-member" || handled) return;
      handled = true;
      onSignedIn(d.email || "");
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
          onSignedIn(parsed?.email || "");
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
    setLogo(f);
    setLogoPreview(f ? URL.createObjectURL(f) : "");
  };

  const toggleOption = (option: string) => {
    setSelectedOptions((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option],
    );
  };

  const goNext = () => {
    if (step === 1 && !tierId) {
      toast({
        variant: "destructive",
        title: "Please choose a sponsorship tier",
      });
      return;
    }
    const tier = data?.tiers.find((t) => t.id === tierId);
    if (
      step === 1 &&
      tier?.collectPayment === false &&
      selectedOptions.length === 0
    ) {
      toast({
        variant: "destructive",
        title: "Please choose at least one option",
      });
      return;
    }
    setStep(2);
  };

  const submit = async () => {
    if (!companyName.trim() || !contactName.trim()) {
      toast({
        variant: "destructive",
        title: "Company and contact name are required",
      });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new window.FormData();
      fd.append("eventId", eventId || "");
      fd.append("sponsorTypeId", tierId);
      fd.append("companyName", companyName.trim());
      fd.append("contactName", contactName.trim());
      fd.append("email", authedEmail || "");
      fd.append("countryCode", countryCode);
      fd.append("phone", phone.trim());
      fd.append("website", website.trim());
      fd.append("message", message.trim());
      if (selectedTier?.collectPayment === false) {
        fd.append("selectedOptions", JSON.stringify(selectedOptions));
      }
      if (logo) fd.append("logo", logo);
      const res = await fetch(`${apiURL}/sponsors/apply`, {
        method: "POST",
        body: fd,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "Submission failed");
      setDone(true);
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

  // Sponsor submits their transfer details + proof after approval.
  const submitPayment = async () => {
    if (!authedEmail) return;
    if (!transactionId.trim() && !proof) {
      toast({
        variant: "destructive",
        title: "Add a transaction reference or a payment screenshot",
      });
      return;
    }
    setPayBusy(true);
    try {
      const fd = new window.FormData();
      if (transactionId.trim()) fd.append("transactionId", transactionId.trim());
      fd.append("paymentMethod", paymentMethod);
      if (proof) fd.append("transactionScreenshot", proof);
      const res = await fetch(
        `${apiURL}/sponsors/event/${eventId}/my-application/${encodeURIComponent(authedEmail)}/payment`,
        { method: "POST", body: fd },
      );
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message || "");
      toast({ title: "Payment submitted — thank you!" });
      setTransactionId("");
      setProof(null);
      await refreshMyApp();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't submit the payment",
        description: e?.message || undefined,
      });
    } finally {
      setPayBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <p className="font-medium">{loadError}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please check the link with the organizer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The organizer hasn't published any tiers.
  if (!data?.tiers?.length && !myApp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <Handshake className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">
              Sponsorships aren't open for this event yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon, or get in touch with the organizer.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
            <h2 className="text-lg font-bold">Application submitted 🎉</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Thanks{companyName ? `, ${companyName}` : ""}! The organizer for{" "}
              <strong>{data?.event?.title || "the event"}</strong> will review
              your application and get back to you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Google sign-in gate.
  if (!authedEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Become a Sponsor</CardTitle>
            <p className="text-sm text-muted-foreground">
              for <strong>{data?.event?.title || "the event"}</strong>
              {data?.event?.location ? ` · ${data.event.location}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Sign in with your Google account to apply. We'll use it to keep
              you updated and to let you complete payment once you're approved.
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already applied → status + payment page.
  if (myApp) {
    const history: any[] = Array.isArray(myApp.statusHistory)
      ? myApp.statusHistory
      : [];
    const awaitingPayment =
      myApp.collectPayment !== false &&
      (myApp.status === "Approved" || myApp.status === "Payment Submitted");
    return (
      <div className="min-h-screen bg-muted/30 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-3 sm:px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Your sponsorship
            </h1>
            <p className="text-sm text-muted-foreground">
              for <strong>{data?.event?.title || "the event"}</strong>
              {data?.event?.location ? ` · ${data.event.location}` : ""}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Status
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[myApp.status] || "bg-stone-100 text-stone-600"}`}
                >
                  {myApp.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg bg-muted/40 p-3 text-sm">
                {statusBlurb(myApp.status)}
              </p>

              <div className="flex items-center justify-between border-y py-2 text-sm font-semibold">
                <span>{myApp.sponsorTypeName}</span>
                <span>
                  {myApp.collectPayment === false
                    ? (myApp.selectedOptions || []).join(", ") || "—"
                    : money(myApp.amount, data?.currency)}
                </span>
              </div>

              {myApp.logo && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Your logo
                  </p>
                  <img
                    src={`${apiURL}${myApp.logo}`}
                    alt={myApp.companyName}
                    className="max-h-20 rounded bg-white object-contain p-2"
                  />
                </div>
              )}

              {/* Payment step — open once the organizer approves */}
              {awaitingPayment && (
                <div className="space-y-3 rounded-xl border p-3">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Wallet className="h-4 w-4 text-primary" />
                    {myApp.status === "Payment Submitted"
                      ? "Update your payment details"
                      : "Complete your payment"}
                  </h4>
                  {myApp.transactionId && (
                    <p className="text-xs text-muted-foreground">
                      Submitted reference: {myApp.transactionId}
                    </p>
                  )}
                  <div>
                    <Label className="text-xs">Payment method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">
                          Bank transfer
                        </SelectItem>
                        <SelectItem value="qr">QR / UPI / PayNow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Transaction reference</Label>
                    <Input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="UTR / transaction ID"
                      className="mt-1"
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
                      className="mt-1"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={submitPayment}
                    disabled={payBusy}
                  >
                    {payBusy && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit payment
                  </Button>
                </div>
              )}

              {myApp.transactionScreenshot && (
                <a
                  href={`${apiURL}${myApp.transactionScreenshot}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Your payment proof
                </a>
              )}

              {/* Timeline */}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-primary" /> Timeline
                </h4>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No updates yet.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {history.map((h, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium">
                              {h.status}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {h.changedAt
                                ? new Date(h.changedAt).toLocaleString()
                                : ""}
                            </span>
                          </div>
                          {h.note && (
                            <p className="text-xs text-muted-foreground">
                              {h.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>
          <p className="pb-6 text-center text-xs text-muted-foreground">
            The organizer will reach out with any next steps.
          </p>
        </div>
      </div>
    );
  }

  // ── Application wizard ────────────────────────────────────────────
  const selectedTier = data?.tiers.find((t) => t.id === tierId);

  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-3 sm:px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Become a Sponsor</h1>
          <p className="text-sm text-muted-foreground">
            for <strong>{data?.event?.title || "the event"}</strong>
            {data?.event?.location ? ` · ${data.event.location}` : ""}
          </p>
        </div>

        <SponsorStepper current={step} />

        {/* STEP 1 — pick a tier */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Handshake className="h-5 w-5 text-primary" /> Choose your
                package
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.tiers.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-xl border transition-colors ${
                    tierId === t.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTierId(t.id);
                      setSelectedOptions([]);
                    }}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{t.name}</div>
                        {t.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right font-bold">
                        <div>
                          {t.price === 0 ? "Free" : money(t.price, data?.currency)}
                        </div>
                        {t.collectPayment === false && (
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Non-cash
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  {tierId === t.id &&
                    t.collectPayment === false &&
                    (t.customOptions?.length ?? 0) > 0 && (
                      <div className="space-y-2 border-t px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          Instead of paying{" "}
                          {t.price === 0 ? "" : money(t.price, data?.currency)},
                          provide the item(s) below (pick any number):
                        </p>
                        {t.customOptions!.map((opt) => {
                          const checked = selectedOptions.includes(opt);
                          return (
                            <label
                              key={opt}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleOption(opt)}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — business details + logo */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-primary" /> Your business
              </CardTitle>
              {selectedTier && (
                <p className="text-sm text-muted-foreground">
                  {selectedTier.name} ·{" "}
                  {selectedTier.collectPayment === false
                    ? selectedOptions.join(", ")
                    : selectedTier.price === 0
                      ? "Free"
                      : money(selectedTier.price, data?.currency)}
                </p>
              )}
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
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
                <Label className="text-xs">Contact number</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-24 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.dialCode}>
                          {c.dialCode} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
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
              <div className="sm:col-span-2">
                <Label className="text-xs">Email (signed in with Google)</Label>
                <Input
                  value={authedEmail || ""}
                  disabled
                  className="bg-muted/50"
                  title="Verified via Google sign-in — can't be changed"
                />
              </div>

              {/* Business logo */}
              <div className="sm:col-span-2">
                <Label className="text-xs">
                  Business logo (shown on the event page once confirmed)
                </Label>
                <div className="mt-1 flex items-center gap-3">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-16 w-16 rounded border bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted/30">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => pickLogo(e.target.files?.[0] || null)}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      PNG or SVG with a transparent background works best.
                    </p>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Message (optional)</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Anything the organizer should know about your business."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={goNext} size="lg" className="flex-1">
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={submitting}
              size="lg"
              className="flex-1"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit application
            </Button>
          )}
        </div>
        <p className="pb-6 text-center text-xs text-muted-foreground">
          You can submit one sponsorship application for this event.
        </p>
      </div>
    </div>
  );
}

// 2-step progress header, styled to match the supplier/stall steppers.
function SponsorStepper({ current }: { current: number }) {
  const steps = ["Package", "Your business"];
  return (
    <div className="mb-1">
      <ol className="flex items-start">
        {steps.map((label, i) => {
          const stepNo = i + 1;
          const done = stepNo < current;
          const active = stepNo === current;
          const isLast = stepNo === steps.length;
          return (
            <li
              key={label}
              className="relative flex flex-1 flex-col items-center"
            >
              {!isLast && (
                <span
                  className={`absolute left-1/2 top-3 h-0.5 w-full ${
                    done ? "bg-primary" : "bg-gray-200"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                  done
                    ? "border-primary bg-primary text-white"
                    : active
                      ? "border-primary bg-white text-primary"
                      : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : stepNo}
              </span>
              <span
                className={`mt-1.5 px-0.5 text-center text-[10px] leading-tight sm:text-xs ${
                  active
                    ? "font-semibold text-primary"
                    : done
                      ? "text-gray-600"
                      : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
