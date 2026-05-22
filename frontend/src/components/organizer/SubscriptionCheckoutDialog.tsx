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
import {
  Loader2,
  QrCode,
  CheckCircle2,
  ExternalLink,
  Hourglass,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildPayNowQrUrl } from "@/lib/paynowQr";

const apiURL = __API_URL__;

interface Props {
  open: boolean;
  onClose: () => void;
  planId: string | null;
  planName: string;
  /** Called once the organizer's mark-paid call succeeds. Parent can refresh
   *  the subscription banner to show "Awaiting confirmation". */
  onSubmitted?: () => void;
}

interface PendingResponse {
  _id: string;
  planId: string;
  planName: string;
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
  if (currency === "INR") return "₹";
  if (currency === "SGD") return "SG$";
  return "$";
}

export function SubscriptionCheckoutDialog({
  open,
  onClose,
  planId,
  planName,
  onSubmitted,
}: Props) {
  const { toast } = useToast();
  const token = sessionStorage.getItem("token");
  const auth = token ? { Authorization: `Bearer ${token}` } : {};

  const [initiating, setInitiating] = useState(false);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrIntent, setQrIntent] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !planId) return;
    let cancelled = false;
    (async () => {
      setInitiating(true);
      setPending(null);
      setQrImage(null);
      setQrIntent(null);
      setQrError(null);
      try {
        const res = await fetch(`${apiURL}/subscriptions/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...auth },
          body: JSON.stringify({ planId }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        if (cancelled) return;
        setPending(data as PendingResponse);
        // Fetch platform config + generate QR in parallel for snappier render.
        await generateQr(data as PendingResponse);
      } catch (e: any) {
        if (cancelled) return;
        toast({
          title: "Couldn't start checkout",
          description: e?.message || "Try again in a moment.",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setInitiating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planId]);

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
      const proxy =
        row.scheme === "UPI" ? cfg.platformUPIId : cfg.companyUEN;
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

      // PayNow: route through the same sgqrcode.com renderer the working
      // ticket/table payment pages use, with the super-admin's companyUEN as
      // the proxy. The backend's EMVCo TLV builder produced QRs banks
      // wouldn't honor.
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
        `${apiURL}/subscriptions/${pending._id}/mark-paid`,
        { method: "POST", headers: { ...auth } },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      setPending({ ...pending, status: "submitted" });
      toast({
        title: "Submitted for confirmation",
        description: "Admin will activate your plan once payment is verified.",
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
            <QrCode className="h-5 w-5" />
            Subscription Checkout
          </DialogTitle>
          <DialogDescription>{planName}</DialogDescription>
        </DialogHeader>

        {initiating || !pending ? (
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
                  ), your plan will activate and a receipt will be sent to
                  your WhatsApp number.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-slate-50 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Amount due
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {symbolFor(pending.currency)}
                  {pending.amount}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Reference
                </div>
                <div className="font-mono text-sm text-slate-700">
                  {pending.ref}
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
                  alt="Subscription payment QR"
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
                      <a
                        href={qrIntent}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in payment app
                      </a>
                    </Button>
                  )}
                  <p className="text-xs text-slate-500">
                    After paying, click <em>I have paid</em> below. The admin
                    will verify and activate your plan.
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
          {!isSubmitted && pending && (
            <Button
              onClick={submitPaid}
              disabled={submitting || !qrImage}
            >
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
