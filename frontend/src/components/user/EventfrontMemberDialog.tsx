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
import { ExhibitorCategoryPicker } from "@/components/ui/ExhibitorCategoryPicker";
import {
  Award,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  QrCode,
  Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface ActiveMembership {
  _id: string;
  exhibitorName?: string;
  exhibitorEmail: string;
  startDate?: string;
  endDate?: string;
  amountPaid: number;
  currency: string;
  paymentRef?: string;
  planId: {
    _id?: string;
    name: string;
    color?: string;
    perks?: string[];
    durationDays?: number;
    price?: number;
    currency?: string;
    description?: string;
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
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
  | "google"
  | "loading"
  | "member"
  | "plans"
  | "purchase_form"
  | "purchase_pay"
  | "submitting"
  | "done";

interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
}

function durationLabel(days: number) {
  if (days % 365 === 0) {
    const y = days / 365;
    return `${y} ${y === 1 ? "year" : "years"}`;
  }
  if (days % 30 === 0) {
    const m = days / 30;
    return `${m} ${m === 1 ? "month" : "months"}`;
  }
  return `${days} days`;
}

function daysLeft(endDate?: string): number | null {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const ms = end - now;
  if (ms < 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function EventfrontMemberDialog({ open, onClose, organizerId }: Props) {
  const apiURL = __API_URL__;
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("google");
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [active, setActive] = useState<ActiveMembership | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  // Purchase form / payment state
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentQR, setPaymentQR] = useState<string | null>(null);
  const [payeeLabel, setPayeeLabel] = useState<string | null>(null);

  const reset = () => {
    setStep("google");
    setProfile(null);
    setActive(null);
    setPlans([]);
    setSelectedPlan(null);
    setBusinessName("");
    setBusinessCategory("");
    setWhatsapp("");
    setTransactionId("");
    setPaymentQR(null);
    setPayeeLabel(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onClose();
  };

  // Popup handle so we can detect a manual close and stop the flow.
  const popupRef = useRef<Window | null>(null);

  // Step 1: Open a popup to the backend's /auth/google-member endpoint.
  // The backend completes the Google OAuth round-trip (so only the
  // backend origin needs to be registered with Google Cloud — NOT the
  // frontend dev URL) and replies with a `window.postMessage` carrying
  // the user's email + name. We listen for that message and continue
  // the membership lookup inline.
  const handleGoogleLogin = () => {
    const url = `${apiURL}/auth/google-member`;
    const w = 480;
    const h = 600;
    const left =
      typeof window !== "undefined"
        ? window.screenX + (window.outerWidth - w) / 2
        : 0;
    const top =
      typeof window !== "undefined"
        ? window.screenY + (window.outerHeight - h) / 2
        : 0;
    const popup = window.open(
      url,
      "eventsh-google-member",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }
    popupRef.current = popup;
    setStep("loading");
  };

  // Shared "we got a profile, now continue" path — used by both the
  // postMessage listener and the localStorage handshake fallback so
  // either delivery channel reaches the same lookup logic.
  const handleProfileArrived = async (data: any) => {
    const p: GoogleProfile = {
      email: String(data?.email || "").toLowerCase(),
      name: data?.name || "",
      picture: data?.picture || "",
    };
    return p;
  };

  // postMessage listener — only mounted while the dialog is open, so we
  // don't accidentally consume messages from unrelated flows. Filters
  // by `kind` to ignore noise from extensions/widgets.
  useEffect(() => {
    if (!open) return;
    const onMessage = async (ev: MessageEvent) => {
      const data = ev?.data;
      if (!data || data.kind !== "eventsh:google-member") return;
      const p = await handleProfileArrived(data);
      if (!p.email) {
        toast({
          title: "Sign-in failed",
          description: "Couldn't read your Google email.",
          variant: "destructive",
        });
        setStep("google");
        return;
      }
      setProfile(p);
      try {
        const memRes = await fetch(
          `${apiURL}/exhibitor-memberships/by-email/${encodeURIComponent(
            p.email,
          )}?organizerId=${organizerId}`,
        );
        const raw = await memRes.text();
        const found = raw ? JSON.parse(raw) : null;
        if (found) {
          setActive(found as ActiveMembership);
          setStep("member");
        } else {
          const plansRes = await fetch(
            `${apiURL}/public/membership-plans/by-organizer/${organizerId}`,
          );
          const plansList: MembershipPlan[] = plansRes.ok
            ? await plansRes.json()
            : [];
          setPlans(Array.isArray(plansList) ? plansList : []);
          setStep("plans");
        }
      } catch (e: any) {
        toast({
          title: "Lookup failed",
          description: e?.message,
          variant: "destructive",
        });
        setStep("google");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizerId]);

  // Polls the popup so a user-cancelled sign-in returns to the initial
  // step instead of leaving the dialog stuck on "Looking you up…".
  // Also polls localStorage as a fallback channel — the callback page
  // writes the profile there, and some browsers sever `window.opener`
  // on cross-origin popup navigations so postMessage never lands.
  useEffect(() => {
    if (step !== "loading") return;
    // Snapshot the existing localStorage value (if any) so we only
    // react to a fresh handshake from this sign-in attempt.
    const KEY = "eventsh:google-member";
    const prev = (() => {
      try {
        return localStorage.getItem(KEY) || "";
      } catch {
        return "";
      }
    })();
    let sawPopupClosed = false;
    const t = window.setInterval(async () => {
      // localStorage handshake
      try {
        const raw = localStorage.getItem(KEY);
        if (raw && raw !== prev) {
          window.clearInterval(t);
          // Clear so a future attempt isn't tripped by stale data.
          localStorage.removeItem(KEY);
          const parsed = JSON.parse(raw);
          const p = await handleProfileArrived(parsed);
          if (!p.email) {
            toast({
              title: "Sign-in failed",
              description: "Couldn't read your Google email.",
              variant: "destructive",
            });
            setStep("google");
            return;
          }
          setProfile(p);
          try {
            const memRes = await fetch(
              `${apiURL}/exhibitor-memberships/by-email/${encodeURIComponent(
                p.email,
              )}?organizerId=${organizerId}`,
            );
            const text = await memRes.text();
            const found = text ? JSON.parse(text) : null;
            if (found) {
              setActive(found as ActiveMembership);
              setStep("member");
            } else {
              const plansRes = await fetch(
                `${apiURL}/public/membership-plans/by-organizer/${organizerId}`,
              );
              const plansList: MembershipPlan[] = plansRes.ok
                ? await plansRes.json()
                : [];
              setPlans(Array.isArray(plansList) ? plansList : []);
              setStep("plans");
            }
          } catch (e: any) {
            toast({
              title: "Lookup failed",
              description: e?.message,
              variant: "destructive",
            });
            setStep("google");
          }
          return;
        }
      } catch {
        // ignore — private mode, quota, etc.
      }
      // popup-closed handshake — only abandon when the popup has been
      // closed for MORE than one tick. This stops a fast close()
      // (callback fires postMessage + localStorage + close within
      // ~200 ms) from racing the handshake on the very first poll
      // cycle, which would falsely reset the dialog to "google".
      if (popupRef.current && popupRef.current.closed) {
        if (sawPopupClosed) {
          window.clearInterval(t);
          setStep((s) => (s === "loading" ? "google" : s));
        } else {
          sawPopupClosed = true;
        }
      }
    }, 500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, organizerId]);

  // Build the payment QR when a plan is selected and we move into the
  // purchase form / pay step.
  useEffect(() => {
    if (!selectedPlan || (step !== "purchase_pay" && step !== "purchase_form"))
      return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiURL}/public/membership/payment-info/by-organizer/${organizerId}`,
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
        const dynamic = buildPayNowQrUrl({
          organizer: {
            UENNumber: info.UENNumber,
            payNowId: info.payNowId,
          },
          amount: selectedPlan.price,
          refId: `MEM-${selectedPlan._id.slice(-6)}`,
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
        if (info.paymentURL) {
          setPaymentQR(
            info.paymentURL.startsWith("http")
              ? info.paymentURL
              : `${apiURL}${info.paymentURL}`,
          );
          setPayeeLabel(null);
        }
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiURL, organizerId, selectedPlan, step]);

  const registerPurchase = async () => {
    if (!selectedPlan || !profile) return;
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
        `${apiURL}/public/membership/register/by-organizer/${organizerId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: selectedPlan._id,
            exhibitorName: profile.name,
            exhibitorEmail: profile.email,
            exhibitorWhatsapp: whatsapp.startsWith("+")
              ? whatsapp
              : whatsapp
                ? `+${whatsapp.replace(/\D/g, "")}`
                : "",
            businessName,
            businessCategory,
            amountPaid: selectedPlan.price,
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
      setStep("purchase_pay");
    }
  };

  const planCurrency =
    selectedPlan?.currency ||
    plans[0]?.currency ||
    active?.currency ||
    "USD";
  const planSymbol = CURRENCY_SYMBOLS[planCurrency] || planCurrency;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Exhibitor membership
          </DialogTitle>
          <DialogDescription>
            Sign in with Google to check your member status or purchase a plan.
          </DialogDescription>
        </DialogHeader>

        {step === "google" && (
          <div className="space-y-4 py-2">
            <Button
              className="w-full"
              onClick={handleGoogleLogin}
              variant="outline"
            >
              <Mail className="h-4 w-4 mr-2" />
              Continue with Google
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              We only use your email to look up your membership. No posting
              on your behalf.
            </p>
          </div>
        )}

        {step === "loading" && (
          <div className="py-6 text-center space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Looking you up…</p>
          </div>
        )}

        {step === "member" && active && (
          <div className="space-y-3">
            <div
              className="rounded-xl border-2 p-4 space-y-3"
              style={{
                borderColor: (active.planId?.color || "#10b981") + "55",
                background: (active.planId?.color || "#10b981") + "08",
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: active.planId?.color || "#10b981",
                  }}
                />
                <span
                  className="text-lg font-bold"
                  style={{ color: active.planId?.color || "#10b981" }}
                >
                  {active.planId?.name || "Member"}
                </span>
                <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active
                </span>
              </div>

              {active.planId?.description && (
                <p className="text-sm text-slate-600">
                  {active.planId.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Member</div>
                  <div className="font-medium text-sm">
                    {active.exhibitorName || profile?.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {active.exhibitorEmail}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Valid till</div>
                  <div className="font-medium text-sm flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {active.endDate
                      ? new Date(active.endDate).toLocaleDateString()
                      : "—"}
                  </div>
                  {(() => {
                    const d = daysLeft(active.endDate);
                    if (d == null) return null;
                    return (
                      <div
                        className={`text-[10px] font-semibold mt-0.5 ${
                          d <= 14
                            ? "text-amber-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {d === 0
                          ? "Expires today"
                          : `${d} day${d === 1 ? "" : "s"} left`}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {Array.isArray(active.planId?.perks) &&
                active.planId.perks.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                      Your perks
                    </div>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {active.planId.perks.map((p, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5"
                        >
                          <Star
                            className="h-3 w-3 mt-0.5 shrink-0"
                            style={{
                              color: active.planId?.color || "#10b981",
                            }}
                          />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              <div className="text-[10px] text-muted-foreground border-t pt-2">
                {active.paymentRef ? `Ref: ${active.paymentRef} · ` : ""}
                {planSymbol}
                {active.amountPaid?.toLocaleString?.() || active.amountPaid}
                {" paid"}
              </div>
            </div>
            <Button
              onClick={() => handleClose(false)}
              className="w-full"
              variant="outline"
            >
              Close
            </Button>
          </div>
        )}

        {step === "plans" && (
          <div className="space-y-3">
            {plans.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No membership plans are published yet. Check back soon.
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Signed in as <strong>{profile?.email}</strong>. You're not
                  a member yet — pick a plan to join.
                </p>
                {plans.map((p) => {
                  const sym = CURRENCY_SYMBOLS[p.currency] || p.currency;
                  return (
                    <button
                      key={p._id}
                      onClick={() => {
                        setSelectedPlan(p);
                        // Route through the profile step (same form
                        // shape as the original purchase dialog) before
                        // landing on QR + transaction id.
                        setStep("purchase_form");
                      }}
                      className="w-full text-left rounded-xl border-2 bg-white p-3 hover:shadow-md transition flex flex-col gap-1"
                      style={{ borderColor: p.color + "55" }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <span
                          className="font-bold"
                          style={{ color: p.color }}
                        >
                          {p.name}
                        </span>
                        <span className="ml-auto font-bold text-lg">
                          {sym}
                          {p.price.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {durationLabel(p.durationDays)}
                        {p.perks.length
                          ? ` · ${p.perks.length} perks`
                          : ""}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* Profile step — same shape as the original purchase dialog:
            full-width Name, Email, Business name, Business category.
            Name + email come pre-filled from Google but stay editable
            so the exhibitor can correct anything. WhatsApp is folded
            in (optional) because we no longer collect it via OTP. */}
        {step === "purchase_form" && selectedPlan && profile && (
          <div className="space-y-3">
            <div>
              <Label>Your name *</Label>
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => (p ? { ...p, name: e.target.value } : p))
                }
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile((p) =>
                    p ? { ...p, email: e.target.value.toLowerCase() } : p,
                  )
                }
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
              <ExhibitorCategoryPicker
                value={businessCategory}
                onChange={setBusinessCategory}
                placeholder="Select category"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("plans")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (!profile.name.trim() || !profile.email.trim()) {
                    toast({
                      title: "Missing details",
                      description: "Name and email are required.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setStep("purchase_pay");
                }}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "purchase_pay" && selectedPlan && profile && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-semibold">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span>{selectedPlan.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">
                  {planSymbol}
                  {selectedPlan.price.toLocaleString()}
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
                The organizer will cross-check this reference before
                activating your membership.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("purchase_form")}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={registerPurchase}
                className="flex-1"
                style={{ backgroundColor: selectedPlan.color }}
              >
                <Lock className="h-4 w-4 mr-2" />
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
            <p className="font-semibold">Payment received</p>
            <p className="text-sm text-muted-foreground">
              Your membership is pending the organizer's verification. You'll
              get the receipt at {profile?.email} (and on WhatsApp if you
              shared it) once it's activated.
            </p>
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
