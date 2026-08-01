import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  QrCode,
  CheckCircle2,
  ExternalLink,
  Hourglass,
  Coins,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildPayNowQrUrl } from "@/lib/paynowQr";
import { buildUpiQrDataUrl } from "@/lib/upiQr";
import { symbolForCode } from "@/data/currencies";

const apiURL = __API_URL__;

/** Sibling of InlineWalkinForm — renders inline inside a chatbot bubble.
 *  Drives the token endpoints (/tokens/topup, /tokens/topup/:id/mark-paid)
 *  plus /admin/payment-config — same flow as the dashboard's
 *  BuyTokensDialog, condensed for the chat surface. */

export interface TokenTopUpFormPayload {
  /** Organizer name purely for greeting copy. */
  organizerName: string;
}

type Step = "enter_quantity" | "qr_payment" | "done";

interface PendingResponse {
  _id: string;
  tokensRequested: number;
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
  return symbolForCode(currency);
}

export function InlineTokenTopUpForm({
  payload,
}: {
  payload: TokenTopUpFormPayload;
}) {
  const { toast } = useToast();
  const token = sessionStorage.getItem("token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  const [step, setStep] = useState<Step>("enter_quantity");
  const [tokens, setTokens] = useState("");

  const [initiating, setInitiating] = useState(false);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntent, setQrIntent] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initiateAndQr = async () => {
    const qty = Number(tokens);
    if (!qty || qty <= 0) {
      toast({
        duration: 4000,
        title: "Enter a token amount",
        description: "How many tokens would you like to buy?",
        variant: "destructive",
      });
      return;
    }
    setInitiating(true);
    setPending(null);
    setQrImage(null);
    setQrIntent(null);
    setQrError(null);
    setStep("qr_payment");
    try {
      const res = await fetch(`${apiURL}/tokens/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ tokensRequested: qty }),
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
      setStep("enter_quantity");
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
      if (!cfgRes.ok) throw new Error("Platform payment isn't configured yet.");
      const cfg = (await cfgRes.json()) as PlatformConfig;
      const proxy = row.scheme === "UPI" ? cfg.platformUPIId : cfg.companyUEN;
      if (!proxy) {
        throw new Error(
          row.scheme === "UPI"
            ? "Platform UPI ID isn't configured yet."
            : "Company UEN isn't configured yet.",
        );
      }
      if (!cfg.companyName) throw new Error("Company name isn't configured yet.");

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

      const { uri, dataUrl } = await buildUpiQrDataUrl({
        payeeVpa: proxy,
        payeeName: cfg.companyName,
        amount: row.amount,
        currency: row.currency,
        note: `${row.tokensRequested} tokens`,
        refId: row.ref,
      });
      setQrImage(dataUrl);
      setQrIntent(uri);
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
      const res = await fetch(`${apiURL}/tokens/topup/${pending._id}/mark-paid`, {
        method: "POST",
        headers: { ...auth },
      });
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

  // ----- Step 1: enter quantity ---------------------------------------
  if (step === "enter_quantity") {
    return (
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-1">
          <Coins className="h-3.5 w-3.5" /> Buy tokens
        </div>
        <div className="space-y-2">
          <Label className="text-sm">How many tokens?</Label>
          <Input
            type="number"
            min={1}
            value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            placeholder="e.g. 500"
          />
        </div>
        <Button
          onClick={initiateAndQr}
          disabled={!tokens || initiating}
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
              Tokens
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {pending ? pending.tokensRequested : "…"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Amount
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {sym}
              {pending ? pending.amount.toFixed(2) : "…"}
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
              alt="Token top-up QR"
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
            onClick={() => setStep("enter_quantity")}
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
          . Once verified, your tokens are credited and a receipt is sent to
          your email and WhatsApp.
        </div>
      </div>
    </div>
  );
}
