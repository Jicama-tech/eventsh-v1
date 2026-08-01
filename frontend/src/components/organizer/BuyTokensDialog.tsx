import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Props {
  open: boolean;
  onClose: () => void;
  /** Prefills the quantity input — typically the shortfall from an estimate. */
  defaultTokens?: number;
  onSubmitted?: () => void;
}

interface TopUpResponse {
  _id: string;
  tokensRequested: number;
  amount: number;
  currency: string;
  scheme: "UPI" | "PAYNOW";
  ref: string;
  status: "awaiting_payment" | "submitted" | "confirmed" | "rejected";
  submittedAt: string | null;
}

interface PlatformConfig {
  companyName: string;
  companyUEN: string;
  platformUPIId: string;
}

function symbolFor(currency: string) {
  return symbolForCode(currency);
}

export function BuyTokensDialog({
  open,
  onClose,
  defaultTokens,
  onSubmitted,
}: Props) {
  const { toast } = useToast();
  const token = sessionStorage.getItem("token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  const [tokens, setTokens] = useState<string>(
    defaultTokens && defaultTokens > 0 ? String(Math.ceil(defaultTokens)) : "",
  );
  const [initiating, setInitiating] = useState(false);
  const [pending, setPending] = useState<TopUpResponse | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntent, setQrIntent] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTokens(
      defaultTokens && defaultTokens > 0 ? String(Math.ceil(defaultTokens)) : "",
    );
    setPending(null);
    setQrImage(null);
    setQrIntent(null);
    setQrError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startTopUp = async () => {
    const qty = Number(tokens);
    if (!qty || qty <= 0) {
      toast({
        title: "Enter a token amount",
        description: "How many tokens would you like to buy?",
        variant: "destructive",
      });
      return;
    }
    setInitiating(true);
    try {
      const res = await fetch(`${apiURL}/tokens/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ tokensRequested: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setPending(data as TopUpResponse);
      await generateQr(data as TopUpResponse);
    } catch (e: any) {
      toast({
        title: "Couldn't start checkout",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setInitiating(false);
    }
  };

  const generateQr = async (row: TopUpResponse) => {
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
      setPending({ ...pending, status: "submitted" });
      toast({
        title: "Submitted for confirmation",
        description: "Admin will verify your payment and confirm shortly.",
      });
      onSubmitted?.();
    } catch (e: any) {
      toast({
        title: "Couldn't submit",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = pending?.status === "submitted";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Buy tokens
          </DialogTitle>
          <DialogDescription>
            Tokens are shared across all your events — 1 token = 1 unit of
            your local currency.
          </DialogDescription>
        </DialogHeader>

        {!pending ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tokens-qty">How many tokens?</Label>
              <Input
                id="tokens-qty"
                type="number"
                min={1}
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                placeholder="e.g. 500"
                autoFocus
              />
            </div>
          </div>
        ) : initiating ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing your
            checkout…
          </div>
        ) : isSubmitted ? (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <Hourglass className="h-6 w-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-amber-900">
                  Awaiting admin confirmation
                </h4>
                <p className="text-sm text-amber-800 mt-1">
                  We've notified the admin. Once they verify your transfer
                  (reference{" "}
                  <code className="bg-white border px-1 rounded text-xs">
                    {pending.ref}
                  </code>
                  ), {pending.tokensRequested} tokens will be added to your
                  wallet and a receipt sent to your email and WhatsApp number.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-slate-50 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Tokens
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {pending.tokensRequested}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Amount
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {symbolFor(pending.currency)}
                  {pending.amount}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {pending.scheme === "UPI"
                    ? "UPI · India"
                    : "PayNow · Singapore"}
                </div>
              </div>
            </div>

            {qrLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating QR…
              </div>
            ) : qrError ? (
              <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm">
                {qrError}
              </div>
            ) : qrImage ? (
              <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                <img
                  src={qrImage}
                  alt="Token top-up QR"
                  className="w-56 h-56 rounded-md border bg-white p-2"
                />
                <div className="flex-1 space-y-2 text-sm">
                  <p>
                    Scan with any{" "}
                    <strong>
                      {pending.scheme === "UPI"
                        ? "UPI app (GPay, PhonePe, Paytm…)"
                        : "PayNow-enabled bank app"}
                    </strong>{" "}
                    and pay{" "}
                    <strong>
                      {symbolFor(pending.currency)}
                      {pending.amount}
                    </strong>
                    .
                  </p>
                  {qrIntent && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={qrIntent} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in payment app
                      </a>
                    </Button>
                  )}
                  <p className="text-xs text-slate-500">
                    After paying, click <em>I have paid</em> below. The admin
                    will verify and credit your wallet.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {isSubmitted ? "Close" : "Cancel"}
          </Button>
          {!pending && (
            <Button onClick={startTopUp} disabled={initiating}>
              {initiating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting…
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Continue
                </>
              )}
            </Button>
          )}
          {pending && !isSubmitted && (
            <Button onClick={submitPaid} disabled={submitting || !qrImage}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />I have paid
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
