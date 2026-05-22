import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  QrCode,
  CheckCircle2,
  ExternalLink,
  Hourglass,
  Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildPayNowQrUrl } from "@/lib/paynowQr";

const apiURL = __API_URL__;

/** Sibling of InlineWalkinForm — renders inline inside a chatbot bubble.
 *  Drives the existing platform-fees endpoints (/billing-payments/me,
 *  /billing-payments/initiate, /billing-payments/:id/mark-paid) plus
 *  /admin/payment-config + /payments/generate-qr — same flow as the
 *  dashboard's BillingPaymentDialog, condensed for the chat surface. */

export interface PlatformFeeFormPayload {
  /** Organizer name purely for greeting copy. */
  organizerName: string;
}

type Step = "pick_event" | "qr_payment" | "done";

type BillingRow = {
  eventId: string;
  title: string;
  amount: number;
  claim:
    | {
        _id: string;
        status: "awaiting_payment" | "submitted" | "confirmed" | "rejected";
        amount: number;
        currency: string;
        ref: string;
      }
    | null;
};

interface MyBillingResponse {
  rates: { currency: string };
  events: BillingRow[];
  region: { scheme: "UPI" | "PAYNOW"; currency: string } | null;
}

interface PendingResponse {
  _id: string;
  eventId: string;
  amount: number;
  currency: string;
  scheme: "UPI" | "PAYNOW";
  ref: string;
  status: "awaiting_payment" | "submitted" | "confirmed" | "rejected";
}

interface PlatformConfig {
  companyName: string;
  companyUEN: string;
  platformUPIId: string;
}

function symbolFor(currency: string) {
  if (currency === "INR") return "₹";
  if (currency === "SGD") return "SG$";
  return "$";
}

export function InlinePlatformFeeForm({
  payload,
}: {
  payload: PlatformFeeFormPayload;
}) {
  const { toast } = useToast();
  const token = sessionStorage.getItem("token");
  const auth = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [step, setStep] = useState<Step>("pick_event");
  const [loadingRows, setLoadingRows] = useState(true);
  const [rows, setRows] = useState<BillingRow[]>([]);
  const [region, setRegion] = useState<
    { scheme: "UPI" | "PAYNOW"; currency: string } | null
  >(null);
  const [selectedEventId, setSelectedEventId] = useState("");

  const [initiating, setInitiating] = useState(false);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntent, setQrIntent] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load the organizer's per-event billing breakdown once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiURL}/billing-payments/me`, {
          headers: { ...auth },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MyBillingResponse;
        if (cancelled) return;
        setRegion(data.region);
        // Only show events that have an outstanding amount and aren't
        // already submitted/confirmed.
        const payable = (data.events || []).filter(
          (r) =>
            r.amount > 0 &&
            (!r.claim ||
              r.claim.status === "rejected" ||
              r.claim.status === "awaiting_payment"),
        );
        setRows(payable);
      } catch (e: any) {
        if (!cancelled) {
          toast({
            duration: 5000,
            title: "Couldn't load your fees",
            description: e?.message || "Try again in a moment.",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoadingRows(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, toast]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.eventId === selectedEventId) || null,
    [rows, selectedEventId],
  );

  const initiateAndQr = async (eventId: string) => {
    setInitiating(true);
    setPending(null);
    setQrImage(null);
    setQrIntent(null);
    setQrError(null);
    setStep("qr_payment");
    try {
      const res = await fetch(`${apiURL}/billing-payments/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setPending(data as PendingResponse);
      await generateQr(data as PendingResponse);
    } catch (e: any) {
      toast({
        duration: 5000,
        title: "Couldn't start payment",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
      setStep("pick_event");
    } finally {
      setInitiating(false);
    }
  };

  const generateQr = async (row: PendingResponse) => {
    setQrLoading(true);
    setQrError(null);
    try {
      const cfgRes = await fetch(`${apiURL}/admin/payment-config`, {
        headers: { ...auth },
      });
      if (!cfgRes.ok) {
        throw new Error("Platform payment isn't configured yet.");
      }
      const cfg = (await cfgRes.json()) as PlatformConfig;
      const proxy = row.scheme === "UPI" ? cfg.platformUPIId : cfg.companyUEN;
      if (!proxy) {
        throw new Error(
          row.scheme === "UPI"
            ? "Platform UPI ID isn't configured yet."
            : "Company UEN isn't configured yet.",
        );
      }
      if (!cfg.companyName) {
        throw new Error("Company name isn't configured yet.");
      }

      // PayNow → sgqrcode (same as SubscriptionCheckoutDialog).
      if (row.scheme === "PAYNOW") {
        const url = buildPayNowQrUrl({
          organizer: { UENNumber: cfg.companyUEN },
          amount: row.amount.toFixed(2),
          refId: row.ref,
          company: cfg.companyName,
        });
        if (!url) throw new Error("Company UEN isn't configured yet.");
        setQrImage(url);
        setQrIntent(null);
        return;
      }

      const params = new URLSearchParams({
        scheme: row.scheme,
        payeeId: proxy,
        payeeName: cfg.companyName,
        amount: row.amount.toFixed(2),
        billNumber: row.ref,
        currency: row.currency,
      });
      const qrRes = await fetch(`${apiURL}/payments/generate-qr?${params}`);
      const qrJson = await qrRes.json();
      if (!qrRes.ok) {
        throw new Error(qrJson?.message || `HTTP ${qrRes.status}`);
      }
      setQrImage(qrJson.qr);
      setQrIntent(qrJson.intent);
    } catch (e: any) {
      setQrError(e?.message || "Failed to generate QR");
    } finally {
      setQrLoading(false);
    }
  };

  const submitPaid = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/billing-payments/${pending._id}/mark-paid`,
        { method: "POST", headers: { ...auth } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setStep("done");
      toast({
        duration: 5000,
        title: "Submitted for confirmation",
        description: "The admin will verify your payment shortly.",
      });
    } catch (e: any) {
      toast({
        duration: 5000,
        title: "Couldn't submit",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Step 1: pick an event ---------------------------------------
  if (step === "pick_event") {
    if (loadingRows) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your outstanding fees…
        </div>
      );
    }
    if (!rows.length) {
      return (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">All clear — nothing to pay.</div>
            <div className="text-emerald-700 mt-0.5">
              You have no outstanding platform fees right now.
            </div>
          </div>
        </div>
      );
    }
    const cur = region?.currency || "USD";
    const sym = symbolFor(cur);
    return (
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-1">
          <Wallet className="h-3.5 w-3.5" /> Pay platform fees
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Which event are you paying for?</Label>
          <Select
            value={selectedEventId}
            onValueChange={setSelectedEventId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pick an event…" />
            </SelectTrigger>
            <SelectContent>
              {rows.map((r) => (
                <SelectItem key={r.eventId} value={r.eventId}>
                  <span className="font-medium">{r.title}</span>
                  <span className="text-slate-500 ml-2">
                    — {sym}
                    {r.amount.toFixed(2)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => selectedRow && initiateAndQr(selectedRow.eventId)}
          disabled={!selectedRow || initiating}
          className="w-full"
        >
          {initiating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Preparing…
            </>
          ) : (
            <>
              <QrCode className="h-4 w-4 mr-2" /> Continue
            </>
          )}
        </Button>
      </div>
    );
  }

  // ----- Step 2: QR payment ------------------------------------------
  if (step === "qr_payment") {
    const sym = pending ? symbolFor(pending.currency) : "$";
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-slate-50 px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Amount due
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {sym}
              {pending ? pending.amount.toFixed(2) : "…"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Reference
            </div>
            <div className="font-mono text-xs text-slate-700">
              {pending?.ref || "…"}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {pending?.scheme === "UPI"
                ? "UPI · India"
                : pending?.scheme === "PAYNOW"
                  ? "PayNow · Singapore"
                  : ""}
            </div>
          </div>
        </div>

        {qrLoading || initiating ? (
          <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating QR…
          </div>
        ) : qrError ? (
          <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm">
            {qrError}
          </div>
        ) : qrImage ? (
          <div className="flex flex-col items-center gap-2">
            <img
              src={qrImage}
              alt="Platform-fee payment QR"
              className="w-48 h-48 rounded-md border bg-white p-2"
            />
            <p className="text-xs text-slate-600 text-center">
              Scan with your{" "}
              <strong>
                {pending?.scheme === "UPI"
                  ? "UPI app"
                  : "PayNow-enabled bank app"}
              </strong>{" "}
              to pay{" "}
              <strong>
                {sym}
                {pending?.amount.toFixed(2)}
              </strong>
              .
            </p>
            {qrIntent && (
              <Button variant="outline" size="sm" asChild>
                <a href={qrIntent} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Open in payment app
                </a>
              </Button>
            )}
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStep("pick_event")}
            className="flex-1"
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            onClick={submitPaid}
            disabled={submitting || !pending || !qrImage}
            className="flex-1"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Submitting…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" /> I have paid
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ----- Step 3: done ------------------------------------------------
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 flex items-start gap-2">
      <Hourglass className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold">Awaiting admin confirmation</div>
        <div className="text-amber-800 mt-0.5">
          Reference{" "}
          <code className="bg-white border px-1 rounded text-xs">
            {pending?.ref}
          </code>
          . Once verified, your event-fee receipt is sent to your email and
          WhatsApp.
        </div>
      </div>
    </div>
  );
}
