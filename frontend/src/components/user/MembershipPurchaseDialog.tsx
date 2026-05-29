import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Lock,
  CheckCircle2,
  MessageCircle,
  QrCode,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { buildPayNowQrUrl, describePayNowPayee } from "@/lib/paynowQr";

interface MembershipPlan {
  _id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  perks: string[];
  color: string;
}

interface Vendor {
  _id: string;
  name?: string;
  email?: string;
  whatsAppNumber?: string;
  whatsappNumber?: string;
  businessName?: string;
  businessType?: string;
}

interface LookupResult {
  vendor: Vendor;
  activeMembership: { _id: string; planId?: any; endDate?: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlan;
  slug: string;
  organizerId: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  GBP: "£",
  EUR: "€",
  SGD: "SG$",
  AED: "AED ",
  AUD: "A$",
};

type Step =
  | "phone"
  | "otp"
  | "profile"
  | "pay"
  | "submitting"
  | "done";

export function MembershipPurchaseDialog({
  open,
  onOpenChange,
  plan,
  slug,
}: Props) {
  const apiURL = __API_URL__;
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [whatsapp, setWhatsapp] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Vendor profile fields — pre-filled if lookup found an existing exhibitor.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [transactionId, setTransactionId] = useState("");
  // Fully-built sgqrcode.com PayNow URL (or fallback to the organizer's
  // static paymentURL image) — whichever is rendered as the scannable QR.
  const [paymentQR, setPaymentQR] = useState<string | null>(null);
  // Human label under the QR — "UEN 200012345A" / "+65 9003 7950" /
  // "Static QR" — so the exhibitor knows who they're paying.
  const [payeeLabel, setPayeeLabel] = useState<string | null>(null);
  const [existingActive, setExistingActive] = useState<
    LookupResult["activeMembership"] | null
  >(null);

  const symbol = CURRENCY_SYMBOLS[plan.currency] || plan.currency;

  const reset = () => {
    setStep("phone");
    setWhatsapp("");
    setOtp("");
    setName("");
    setEmail("");
    setBusinessName("");
    setBusinessCategory("");
    setTransactionId("");
    setPaymentQR(null);
    setPayeeLabel(null);
    setExistingActive(null);
  };

  // Build the QR shown in the Pay step. Prefer a dynamic PayNow QR
  // generated from the organizer's UEN / payNowId (same builder the
  // ticket and stall payment pages use), so the QR encodes the plan's
  // amount and a reference id. Fall back to the organizer's static
  // paymentURL image only when no PayNow proxy is configured.
  useEffect(() => {
    if (!open) {
      setPaymentQR(null);
      setPayeeLabel(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiURL}/storefront/${encodeURIComponent(
            slug,
          )}/membership/payment-info`,
        );
        if (!res.ok) return;
        const raw = await res.text();
        if (!raw) return;
        const info = JSON.parse(raw) as {
          country: string | null;
          UENNumber: string | null;
          payNowId: string | null;
          paymentURL: string | null;
          company: string | null;
        };
        if (cancelled) return;

        // Dynamic PayNow QR — used when either UEN or payNowId is set.
        const dynamic = buildPayNowQrUrl({
          organizer: {
            UENNumber: info.UENNumber,
            payNowId: info.payNowId,
          },
          amount: plan.price,
          refId: `MEM-${plan._id.slice(-6)}`,
          company: info.company || "",
        });

        if (dynamic) {
          setPaymentQR(dynamic);
          setPayeeLabel(
            describePayNowPayee({
              UENNumber: info.UENNumber,
              payNowId: info.payNowId,
            }),
          );
          return;
        }

        // No PayNow proxy — fall back to the organizer's static QR image.
        if (info.paymentURL) {
          setPaymentQR(
            info.paymentURL.startsWith("http")
              ? info.paymentURL
              : `${apiURL}${info.paymentURL}`,
          );
          setPayeeLabel(null);
        }
      } catch {
        // non-fatal — exhibitor can still type a txn ref without a QR
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, apiURL, slug, plan._id, plan.price]);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const sendOtp = async () => {
    if (whatsapp.replace(/[^\d]/g, "").length < 10) {
      toast({
        title: "Invalid WhatsApp number",
        description: "Please enter a valid number including country code.",
        variant: "destructive",
      });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: whatsapp,
          role: "shopkeeper",
        }),
      });
      if (!res.ok) throw new Error("Failed to send OTP");
      toast({ title: "OTP sent to your WhatsApp" });
      setStep("otp");
    } catch (e: any) {
      toast({
        title: "Couldn't send OTP",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || otp.length < 4) {
      toast({
        title: "Invalid OTP",
        description: "Enter the code we sent on WhatsApp.",
        variant: "destructive",
      });
      return;
    }
    setVerifying(true);
    try {
      const fullWA = whatsapp.startsWith("+") ? whatsapp : `+${whatsapp}`;
      const verifyRes = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullWA,
          otp,
          role: "shopkeeper",
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData?.message || "Invalid OTP");

      // OTP verified — now look up the exhibitor for this storefront.
      // The lookup is best-effort: a "no existing exhibitor" response
      // (empty body / null / 404) is the *expected* path for a first-time
      // buyer and must not block the flow. Wrap it in its own try so a
      // parse failure here doesn't surface as a misleading OTP error.
      let lookupData: LookupResult | null = null;
      try {
        const lookupRes = await fetch(
          `${apiURL}/storefront/${encodeURIComponent(
            slug,
          )}/membership/lookup`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ whatsapp: fullWA }),
          },
        );
        if (lookupRes.ok) {
          // NestJS sends an empty body when the handler returns null,
          // which would make .json() throw SyntaxError. Read as text and
          // parse defensively.
          const raw = await lookupRes.text();
          lookupData = raw ? (JSON.parse(raw) as LookupResult | null) : null;
        }
      } catch {
        // non-fatal — treat as "no existing exhibitor", go to blank form
        lookupData = null;
      }

      if (lookupData?.activeMembership) {
        // Already a member — short-circuit to a friendly confirmation.
        setExistingActive(lookupData.activeMembership);
        setStep("done");
        return;
      }

      if (lookupData?.vendor) {
        const v = lookupData.vendor;
        setName(v.name || "");
        setEmail(v.email || "");
        setBusinessName(v.businessName || "");
        setBusinessCategory(v.businessType || "");
      }
      setStep("profile");
    } catch (e: any) {
      toast({
        title: "Couldn't verify OTP",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const onProfileNext = () => {
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Missing details",
        description: "Name and email are required.",
        variant: "destructive",
      });
      return;
    }
    setStep("pay");
  };

  // Payment: same UPI/QR pattern used for stall payments. The exhibitor
  // scans the organizer's QR, pays, and enters their transaction ID.
  // The organizer cross-checks the ref in their dashboard and confirms.
  const register = async () => {
    if (!transactionId.trim()) {
      toast({
        title: "Transaction ID required",
        description:
          "Please enter the UPI / bank reference after completing payment.",
        variant: "destructive",
      });
      return;
    }
    setStep("submitting");
    try {
      const res = await fetch(
        `${apiURL}/storefront/${encodeURIComponent(slug)}/membership/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: plan._id,
            exhibitorName: name,
            exhibitorEmail: email,
            exhibitorWhatsapp: whatsapp.startsWith("+")
              ? whatsapp
              : `+${whatsapp}`,
            businessName,
            businessCategory,
            amountPaid: plan.price,
            paymentRef: transactionId.trim(),
            paymentMethod: "manual",
          }),
        },
      );
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).message || "Failed";
        throw new Error(msg);
      }
      setStep("done");
    } catch (e: any) {
      toast({
        title: "Couldn't save membership",
        description: e?.message,
        variant: "destructive",
      });
      setStep("pay");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: plan.color }}
            />
            {plan.name} membership
          </DialogTitle>
          <DialogDescription>
            {symbol}
            {plan.price.toLocaleString()} for {plan.durationDays} days
          </DialogDescription>
        </DialogHeader>

        {step === "phone" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              We'll send a one-time code to your WhatsApp to verify it's you.
            </p>
            <div>
              <Label>WhatsApp number</Label>
              <PhoneInput
                value={whatsapp}
                onChange={(value) => setWhatsapp(value)}
                country="in"
                enableSearch
                countryCodeEditable={false}
                preferredCountries={["in", "sg", "us", "gb", "ae", "au"]}
                inputProps={{
                  name: "whatsapp",
                  required: true,
                }}
                inputStyle={{
                  width: "100%",
                  height: "40px",
                  fontSize: "14px",
                  paddingLeft: "48px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                }}
                containerStyle={{ width: "100%" }}
                buttonStyle={{
                  borderRadius: "6px 0 0 6px",
                  border: "1px solid #e2e8f0",
                  borderRight: "none",
                }}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Select your country first — the dial code is included
                automatically.
              </p>
            </div>
            <Button onClick={sendOtp} disabled={sending} className="w-full">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <MessageCircle className="h-4 w-4 mr-2" />
              )}
              Send OTP
            </Button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code we sent to {whatsapp}.
            </p>
            <div>
              <Label>OTP</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                placeholder="123456"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("phone")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={verifyOtp}
                disabled={verifying}
                className="flex-1"
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Verify
              </Button>
            </div>
          </div>
        )}

        {step === "profile" && (
          <div className="space-y-3">
            <div>
              <Label>Your name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Business name</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <Label>Business category</Label>
              <Input
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                placeholder="Technology, Food, Fashion…"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("otp")}
                className="flex-1"
              >
                Back
              </Button>
              <Button onClick={onProfileNext} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "pay" && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold">{plan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{plan.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">
                  {symbol}
                  {plan.price.toLocaleString()}
                </span>
              </div>
            </div>

            {paymentQR ? (
              <div className="rounded-lg border p-3 bg-white">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <QrCode className="h-3 w-3" /> Scan to pay
                </p>
                <img
                  src={paymentQR}
                  alt="Payment QR"
                  className="mx-auto max-h-56 object-contain"
                />
                {payeeLabel && (
                  <p className="text-[11px] text-center text-muted-foreground mt-2">
                    Paying to {payeeLabel}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
                The organizer hasn't published a payment QR yet. Please reach
                out for payment instructions, then enter the reference below.
              </div>
            )}

            <div>
              <Label>Transaction ID *</Label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="UPI ref / bank txn id"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                The organizer will cross-check this reference before activating
                your membership.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("profile")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={register}
                className="flex-1"
                style={{ backgroundColor: plan.color }}
              >
                Submit for verification
              </Button>
            </div>
          </div>
        )}

        {step === "submitting" && (
          <div className="py-6 text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              Recording your purchase…
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            {existingActive ? (
              <>
                <p className="font-semibold">You're already a member 🎉</p>
                <p className="text-sm text-muted-foreground">
                  Your current membership is still active
                  {existingActive.endDate
                    ? ` until ${new Date(existingActive.endDate).toLocaleDateString()}`
                    : ""}
                  .
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Payment received</p>
                <p className="text-sm text-muted-foreground">
                  Your membership is pending the organizer's verification.
                  You'll get an email at {email} once it's activated.
                </p>
              </>
            )}
            <Button
              onClick={() => handleClose(false)}
              variant="outline"
              className="mt-2"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
