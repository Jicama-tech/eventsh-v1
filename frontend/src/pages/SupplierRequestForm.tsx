import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  Send,
  ClipboardList,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  Wallet,
  Clock,
  Handshake,
  XCircle,
  Paperclip,
} from "lucide-react";

const apiURL = __API_URL__;

// Same two-country convention used across the organizer CRM (see MyUsers /
// SuppliersDirectory).
const SUPPORTED_COUNTRIES = [
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Singapore", code: "SG", dialCode: "+65" },
];

// Split a stored phone like "+9198…" into its dial code + national part so the
// prefill can re-populate both the country picker and the number field.
function splitPhone(phone?: string): { dialCode: string; number: string } {
  const p = (phone || "").trim();
  const match = SUPPORTED_COUNTRIES.find((c) => p.startsWith(c.dialCode));
  if (match) {
    return { dialCode: match.dialCode, number: p.slice(match.dialCode.length) };
  }
  return { dialCode: SUPPORTED_COUNTRIES[0].dialCode, number: p };
}

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

interface Requirement {
  id: string;
  label: string;
  description?: string;
  /** Outstanding amount — already net of what other suppliers committed. */
  quantity?: string;
  remaining?: number | null;
  partiallyCovered?: boolean;
}
interface FormData {
  requirements: Requirement[];
  instructions: string;
  currency: string;
  event: { id: string; title: string; startDate?: string; location?: string } | null;
}

// SG$ for Singapore, ₹ (INR) for everything else — matches the app convention.
function currencySymbol(country?: string): string {
  return country === "SG" ? "SG$" : "₹";
}
function money(amount: number, country?: string): string {
  return `${currencySymbol(country)}${Number(amount || 0).toLocaleString()}`;
}

const STATUS_STYLES: Record<string, string> = {
  Quoted: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  Negotiating: "bg-purple-100 text-purple-700",
  "Partially Paid": "bg-teal-100 text-teal-700",
  Paid: "bg-green-100 text-green-700",
  Completed: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Cancelled: "bg-stone-200 text-stone-600",
};

// Friendly one-liner shown under the status badge on the supplier's timeline.
function statusBlurb(status: string): string {
  switch (status) {
    case "Approved":
      return "Your quotation was approved 🎉 The organizer will be in touch about payment.";
    case "Rejected":
      return "Unfortunately your quotation wasn't accepted this time.";
    case "Negotiating":
      return "The organizer sent a counter-offer — see their note below.";
    case "Partially Paid":
      return "The organizer has paid part of your quote — the balance below is still outstanding.";
    case "Paid":
      return "Payment has been recorded in full. Thank you!";
    case "Completed":
      return "This job is marked complete. Thank you!";
    case "Cancelled":
      return "This request was cancelled.";
    default:
      return "Your quotation has been submitted and is awaiting the organizer's review.";
  }
}

export default function SupplierRequestForm() {
  const { id: eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<FormData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Wizard step: 1 = your details, 2 = quotation, 3 = payment.
  const [step, setStep] = useState(1);

  // Gmail sign-in gate (mirrors the Stall Form): the supplier proves they own
  // the email via Google OAuth, then we look up their saved profile for prefill.
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  // Set when the signed-in supplier has already submitted for this event — we
  // then show the status timeline instead of the (blocked) form.
  const [myRequest, setMyRequest] = useState<any | null>(null);
  // Supplier negotiation reply + payment-confirmation sub-dialogs.
  const [respondAction, setRespondAction] = useState<
    null | "Approved" | "Negotiating" | "Rejected"
  >(null);
  const [respondNote, setRespondNote] = useState("");
  const [respondBusy, setRespondBusy] = useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [payConfirmBusy, setPayConfirmBusy] = useState(false);

  // Supplier fields
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [email, setEmail] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [countryCode, setCountryCode] = useState(SUPPORTED_COUNTRIES[0].dialCode);
  const [phone, setPhone] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  // How much of each requirement this supplier can actually cover.
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  // Account details (where the organizer pays)
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscSwiftUen, setIfscSwiftUen] = useState("");
  const [upiPaynowId, setUpiPaynowId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiURL}/suppliers/form/${eventId}`);
        const j = await res.json();
        if (!res.ok)
          throw new Error(j?.message || "This form is not available.");
        setData(j.data);
      } catch (e: any) {
        setLoadError(e?.message || "This form is not available.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // Open the Google OAuth popup (reuses the same backend flow as the Stall
  // Form: /auth/google-member → /eventsh-google-member-callback).
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

  // Once the Google email is verified, look up the supplier's saved profile
  // for this event's organizer and prefill; if none exists, they self-register
  // with the email locked in.
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
    setEmail(clean);
    setAuthedEmail(clean);
    try {
      // Already submitted for this event? Show the timeline instead of the form.
      const mineRes = await fetch(
        `${apiURL}/suppliers/event/${eventId}/my-request/${encodeURIComponent(clean)}`,
      );
      const mineJson = mineRes.ok ? await mineRes.json() : { data: null };
      if (mineJson?.data?.request) {
        setMyRequest(mineJson.data);
        return;
      }

      // Otherwise prefill from a saved supplier profile (if any).
      const res = await fetch(
        `${apiURL}/suppliers/event/${eventId}/supplier-by-email/${encodeURIComponent(clean)}`,
      );
      const j = res.ok ? await res.json() : { data: null };
      const s = j?.data;
      if (s) {
        setName(s.name || "");
        setCompanyName(s.companyName || "");
        setServiceCategory(s.serviceCategory || "");
        setBusinessEmail(s.businessEmail || "");
        const { dialCode, number } = splitPhone(s.phone);
        setCountryCode(dialCode);
        setPhone(number);
        // Payout details saved from a previous quotation — prefilled so they
        // don't have to type their bank details again.
        const acc = s.accountDetails || {};
        setAccountHolderName(acc.accountHolderName || "");
        setBankName(acc.bankName || "");
        setAccountNumber(acc.accountNumber || "");
        setIfscSwiftUen(acc.ifscSwiftUen || "");
        setUpiPaynowId(acc.upiPaynowId || "");
        toast({
          title: `Welcome back${s.name ? `, ${s.name}` : ""}!`,
          description: "We prefilled your details — update anything if needed.",
        });
      } else {
        toast({
          title: "Signed in",
          description: "No saved profile found — please fill in your details.",
        });
      }
    } catch {
      // Non-fatal: they can still fill the form manually.
    } finally {
      setGoogleLoading(false);
    }
  };

  // Reload the supplier's request + timeline after they act.
  const refreshMyRequest = async () => {
    if (!authedEmail) return;
    try {
      const res = await fetch(
        `${apiURL}/suppliers/event/${eventId}/my-request/${encodeURIComponent(authedEmail)}`,
      );
      const j = res.ok ? await res.json() : { data: null };
      if (j?.data?.request) setMyRequest(j.data);
    } catch {
      /* keep showing the last-known state */
    }
  };

  // Supplier's negotiation reply (Approve / Negotiate / Reject).
  const submitRespond = async () => {
    if (!respondAction || !authedEmail) return;
    if (respondAction !== "Approved" && !respondNote.trim()) {
      toast({
        variant: "destructive",
        title:
          respondAction === "Rejected"
            ? "Please add a reason"
            : "Please add your offer",
      });
      return;
    }
    setRespondBusy(true);
    try {
      const res = await fetch(
        `${apiURL}/suppliers/event/${eventId}/my-request/${encodeURIComponent(authedEmail)}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: respondAction,
            note: respondNote.trim(),
          }),
        },
      );
      if (!res.ok) throw new Error();
      toast({
        title:
          respondAction === "Approved"
            ? "Approved 🎉"
            : respondAction === "Rejected"
              ? "Declined"
              : "Offer sent",
      });
      setRespondAction(null);
      setRespondNote("");
      await refreshMyRequest();
    } catch {
      toast({ variant: "destructive", title: "Couldn't send your response" });
    } finally {
      setRespondBusy(false);
    }
  };

  // Supplier confirms the organizer's payment + uploads their invoice/bill.
  const submitConfirmPayment = async () => {
    if (!authedEmail) return;
    setPayConfirmBusy(true);
    try {
      const fd = new window.FormData();
      if (invoiceFile) fd.append("invoice", invoiceFile);
      const res = await fetch(
        `${apiURL}/suppliers/event/${eventId}/my-request/${encodeURIComponent(authedEmail)}/confirm-payment`,
        { method: "POST", body: fd },
      );
      if (!res.ok) throw new Error();
      toast({ title: "Payment confirmed — thank you!" });
      setPayConfirmOpen(false);
      setInvoiceFile(null);
      await refreshMyRequest();
    } catch {
      toast({ variant: "destructive", title: "Couldn't confirm the payment" });
    } finally {
      setPayConfirmBusy(false);
    }
  };

  // Receive the Google profile via postMessage + polled localStorage handshake
  // (dual-channel, matching EventfrontGoogleMemberCallback) while a sign-in is
  // in flight.
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

  const currency = data?.currency;
  const total = useMemo(
    () =>
      Object.values(prices).reduce((s, v) => s + (Number(v) || 0), 0),
    [prices],
  );

  // Advance to the next step, gating on the current step's required fields.
  const goNext = () => {
    if (step === 1 && !name.trim()) {
      toast({ variant: "destructive", title: "Please enter your name" });
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const submit = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Please enter your name" });
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const items = (data?.requirements || []).map((r) => ({
        requirementId: r.id,
        requirementLabel: r.label,
        quantity: Number(quantities[r.id]) || 0,
        price: Number(prices[r.id]) || 0,
      }));
      const account = {
        accountHolderName,
        bankName,
        accountNumber,
        ifscSwiftUen,
        upiPaynowId,
      };
      const fd = new window.FormData();
      fd.append("eventId", eventId || "");
      fd.append("name", name);
      fd.append("email", email);
      fd.append("businessEmail", businessEmail);
      fd.append("countryCode", countryCode);
      fd.append("phone", phone.trim() ? `${countryCode}${phone.trim()}` : "");
      fd.append("companyName", companyName);
      fd.append("serviceCategory", serviceCategory);
      fd.append("quotationItems", JSON.stringify(items));
      fd.append("quotationTotal", String(total));
      fd.append("quotationNotes", notes);
      fd.append("accountDetails", JSON.stringify(account));
      if (attachment) fd.append("quotationAttachment", attachment);
      const res = await fetch(`${apiURL}/suppliers/register`, {
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

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
            <h2 className="text-lg font-bold">Quotation submitted 🎉</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Thanks{name ? `, ${name}` : ""}! The organizer for{" "}
              <strong>{data?.event?.title || "the event"}</strong> will review
              your quotation and get back to you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Gmail sign-in gate — must sign in before filling the quotation.
  if (!authedEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Supplier Quotation</CardTitle>
            <p className="text-sm text-muted-foreground">
              for <strong>{data?.event?.title || "the event"}</strong>
              {data?.event?.location ? ` · ${data.event.location}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Sign in with your Google (Gmail) account to submit your quotation.
              We'll prefill your details if you've quoted before.
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

  // Already submitted → show the status timeline (submitted → negotiate /
  // approve / reject → payment) instead of the form.
  if (myRequest?.request) {
    const req = myRequest.request;
    const history: any[] = Array.isArray(req.statusHistory)
      ? req.statusHistory
      : [];
    // Paid / outstanding. Falls back to the difference for records written
    // before the organizer could pay in instalments.
    const paid = Number(req.payment?.amountPaid) || 0;
    const balance =
      req.payment?.balanceDue != null
        ? Number(req.payment.balanceDue)
        : Math.max(0, (Number(req.quotationTotal) || 0) - paid);
    return (
      <div className="min-h-screen bg-muted/30 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl space-y-4 px-3 sm:px-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold sm:text-3xl">Your quotation</h1>
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
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[req.status] || "bg-stone-100 text-stone-600"}`}
                >
                  {req.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="rounded-lg bg-muted/40 p-3 text-sm">
                {statusBlurb(req.status)}
              </p>

              <div className="space-y-1.5 border-y py-2 text-sm">
                <div className="flex items-center justify-between font-semibold">
                  <span>Your total quote</span>
                  <span>{money(req.quotationTotal, data?.currency)}</span>
                </div>
                {/* Once the organizer has paid anything, show the running
                    total and the difference still owed. */}
                {paid > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Received so far
                      </span>
                      <span className="font-medium text-green-700">
                        {money(paid, data?.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>Balance outstanding</span>
                      <span
                        className={
                          balance > 0 ? "text-amber-700" : "text-green-700"
                        }
                      >
                        {money(balance, data?.currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
              {req.quotationNotes && (
                <p className="text-xs text-muted-foreground">
                  Your note: {req.quotationNotes}
                </p>
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

              {/* Each transfer the organizer made, with its proof */}
              {(req.payment?.installments?.length || 0) > 0 && (
                <div className="border-t pt-3">
                  <h4 className="mb-1.5 text-sm font-semibold">Payments received</h4>
                  <ul className="space-y-1 text-xs">
                    {req.payment.installments.map((p: any, i: number) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0 text-muted-foreground">
                          {p.paidDate
                            ? new Date(p.paidDate).toLocaleDateString()
                            : `Payment ${i + 1}`}
                          {p.reference ? ` · ${p.reference}` : ""}
                          {p.proofScreenshot && (
                            <a
                              href={`${apiURL}${p.proofScreenshot}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1.5 inline-flex items-center text-primary hover:underline"
                              title="View proof"
                            >
                              <Paperclip className="h-3 w-3" />
                            </a>
                          )}
                        </span>
                        <span className="shrink-0 font-medium">
                          {money(p.amount, data?.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Payment attachments (proof from organizer, invoice from you) */}
              {(req.payment?.proofScreenshot || req.payment?.invoice) && (
                <div className="flex flex-wrap gap-3 border-t pt-3 text-xs">
                  {req.payment?.proofScreenshot && (
                    <a
                      href={`${apiURL}${req.payment.proofScreenshot}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> Latest payment proof
                    </a>
                  )}
                  {req.payment?.invoice && (
                    <a
                      href={`${apiURL}${req.payment.invoice}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      <Paperclip className="h-3.5 w-3.5" /> Your invoice
                    </a>
                  )}
                </div>
              )}

              {/* Supplier actions — negotiate back, or confirm payment */}
              {req.status === "Negotiating" && (
                <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="flex-1 border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setRespondNote("");
                      setRespondAction("Approved");
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                    onClick={() => {
                      setRespondNote("");
                      setRespondAction("Negotiating");
                    }}
                  >
                    <Handshake className="mr-1.5 h-4 w-4" /> Negotiate
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setRespondNote("");
                      setRespondAction("Rejected");
                    }}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
              {req.status === "Paid" && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setInvoiceFile(null);
                    setPayConfirmOpen(true);
                  }}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm payment &
                  upload invoice
                </Button>
              )}
            </CardContent>
          </Card>
          <p className="pb-6 text-center text-xs text-muted-foreground">
            The organizer will reach out with any next steps.
          </p>
        </div>

        {/* Supplier respond (note) dialog */}
        <Dialog
          open={!!respondAction}
          onOpenChange={(o) => !o && setRespondAction(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {respondAction === "Approved"
                  ? "Approve"
                  : respondAction === "Rejected"
                    ? "Decline"
                    : "Send a counter-offer"}
              </DialogTitle>
              <DialogDescription>
                {respondAction === "Approved"
                  ? "Accept the organizer's terms (add a message if you like)."
                  : respondAction === "Rejected"
                    ? "Let the organizer know why."
                    : "Reply with your offer or terms."}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={respondNote}
              onChange={(e) => setRespondNote(e.target.value)}
              placeholder={
                respondAction === "Approved"
                  ? "e.g. Happy to proceed!"
                  : respondAction === "Rejected"
                    ? "Reason"
                    : "e.g. I can do ₹48,000 including delivery."
              }
              className="min-h-[90px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRespondAction(null)}>
                Cancel
              </Button>
              <Button onClick={submitRespond} disabled={respondBusy}>
                {respondBusy && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {respondAction === "Approved"
                  ? "Approve"
                  : respondAction === "Rejected"
                    ? "Decline"
                    : "Send offer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Supplier confirm-payment dialog */}
        <Dialog
          open={payConfirmOpen}
          onOpenChange={(o) => !o && setPayConfirmOpen(false)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm payment received</DialogTitle>
              <DialogDescription>
                Confirm you received the payment and upload your invoice or
                bill.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label className="text-xs">Invoice / bill (image or PDF)</Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPayConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={submitConfirmPayment} disabled={payConfirmBusy}>
                {payConfirmBusy && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl space-y-4 px-3 sm:px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold sm:text-3xl">Supplier Quotation</h1>
          <p className="text-sm text-muted-foreground">
            for <strong>{data?.event?.title || "the event"}</strong>
            {data?.event?.location ? ` · ${data.event.location}` : ""}
          </p>
        </div>

        <SupplierStepper current={step} />

        {/* STEP 1 — Personal & company details */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-primary" /> Personal & company
                details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Your name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Service (e.g. Catering)</Label>
                <Input
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
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
                <Label className="text-xs">Business email</Label>
                <Input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Email (signed in with Google)</Label>
                <Input
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted/50"
                  title="Verified via Google sign-in — can't be changed"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2 — Quotation (requirements + per-item price) */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5 text-primary" /> Your quotation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.instructions && (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {data.instructions}
                </p>
              )}
              {(data?.requirements || []).some((r) => r.partiallyCovered) && (
                <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                  Some items are already partly covered by other suppliers —
                  the quantities below are what's still outstanding.
                </p>
              )}
              {(data?.requirements || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Everything the organizer listed is already covered by other
                  suppliers. Add anything else you can offer in the notes below.
                </p>
              ) : (
                (data?.requirements || []).map((r) => (
                  <div key={r.id} className="rounded-xl border p-3">
                    {/* Name + what's needed on one line, detail underneath */}
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{r.label}</span>
                      {r.quantity && (
                        <span className="text-xs font-semibold text-primary">
                          {r.partiallyCovered ? "Still needed" : "Needed"}:{" "}
                          {r.quantity}
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                    {/* A supplier rarely covers the whole requirement — they
                        say how much they can do, and price just that. */}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Quantity you can supply
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          value={quantities[r.id] || ""}
                          onChange={(e) =>
                            setQuantities((q) => ({
                              ...q,
                              [r.id]: e.target.value,
                            }))
                          }
                          placeholder="e.g. 120"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Your price for that quantity
                        </Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={prices[r.id] || ""}
                          onChange={(e) =>
                            setPrices((p) => ({ ...p, [r.id]: e.target.value }))
                          }
                          placeholder={currencySymbol(currency)}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between border-t pt-3 font-semibold">
                <span>Total quote</span>
                <span>{money(total, currency)}</span>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Notes (optional)
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the organizer should know about your quote."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Attach a quotation (optional — image or PDF)
                </Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3 — Payment details */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-primary" /> Where the organizer
                pays you
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {accountHolderName && (
                <p className="sm:col-span-2 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
                  Prefilled from your last quotation — update anything that has
                  changed.
                </p>
              )}
              <div>
                <Label className="text-xs">Account holder name</Label>
                <Input
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Bank name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Account number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">IFSC / SWIFT / UEN</Label>
                <Input
                  value={ifscSwiftUen}
                  onChange={(e) => setIfscSwiftUen(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">UPI / PayNow (optional)</Label>
                <Input
                  value={upiPaynowId}
                  onChange={(e) => setUpiPaynowId(e.target.value)}
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
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={submitting}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          )}
          {step < 3 ? (
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
              Submit quotation
            </Button>
          )}
        </div>
        <p className="pb-6 text-center text-xs text-muted-foreground">
          You can submit one quotation for this event.
        </p>
      </div>
    </div>
  );
}

// 3-step progress header for the supplier quotation wizard, styled to match
// the stall flow's StallStepper (numbered circles + connector lines).
function SupplierStepper({ current }: { current: number }) {
  const steps = ["Your details", "Quotation", "Payment"];
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
