import { useState, useRef, useMemo } from "react";
import QRCode from "react-qr-code";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  MapPin,
  CheckCircle2,
  Loader2,
  Banknote,
  QrCode,
  ArrowLeft,
  Plus,
} from "lucide-react";

const apiURL = __API_URL__;

interface VisitorType {
  id: string;
  name: string;
  price: number;
  description?: string;
  maxCount?: number;
}

export interface WalkinFormPayload {
  organizationName: string;
  country: string;
  whatsAppNumber?: string;
  paymentURL?: string;
  events: {
    id: string;
    title: string;
    startDate?: string;
    time?: string;
    venue?: string;
    visitorTypes: VisitorType[];
  }[];
}

type Step =
  | "pick_event"
  | "pick_type"
  | "customer"
  | "qr_payment"
  | "done";
type PaymentMethod = "cash" | "qr" | null;

function shortRand(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function formatPrice(country: string, n: number) {
  const sym = country === "SG" ? "S$" : country === "US" ? "$" : "₹";
  return `${sym}${n}`;
}

export function InlineWalkinForm({
  payload,
  organizerId,
}: {
  payload: WalkinFormPayload;
  organizerId: string;
}) {
  const country = (payload.country || "").toUpperCase();
  const sym = country === "SG" ? "S$" : country === "US" ? "$" : "₹";
  const defaultDial = country === "SG" ? "+65" : "+91";

  const [step, setStep] = useState<Step>("pick_event");
  const [eventId, setEventId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState(defaultDial);
  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [qrPayload, setQrPayload] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrPreparing, setQrPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ticketId: string;
    name: string;
    whatsapp: string;
    email?: string;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const event = useMemo(
    () => payload.events.find((e) => e.id === eventId),
    [payload.events, eventId],
  );
  const type = useMemo(
    () => event?.visitorTypes.find((t) => t.id === typeId),
    [event, typeId],
  );

  const advanceFromEvent = (id: string) => {
    setEventId(id);
    const ev = payload.events.find((e) => e.id === id);
    if (!ev) return;
    if (!ev.visitorTypes.length) {
      // Free entry
      setTypeId("free_entry");
      setStep("customer");
    } else if (ev.visitorTypes.length === 1) {
      setTypeId(ev.visitorTypes[0].id);
      setStep("customer");
    } else {
      setStep("pick_type");
    }
  };

  const effectiveType: VisitorType =
    type || { id: "free_entry", name: "Free Entry", price: 0 };
  const totalPrice = Number(effectiveType.price) || 0;

  const extractUpiFromImage = (imageUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = canvasRef.current || document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve("");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(data.data, c.width, c.height);
        if (code?.data?.includes("upi://pay")) {
          const m = code.data.match(/pa=([^&]+)/);
          resolve(m?.[1] || "");
        } else resolve("");
      };
      img.onerror = () => resolve("");
      img.src = imageUrl;
    });

  const buildUpi = (upi: string, amount: number, refId: string) =>
    `upi://pay?pa=${upi}&pn=${encodeURIComponent(
      payload.organizationName || "Payment",
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Ticket - ${refId}`)}`;

  const buildPayNow = (amount: number, refId: string) => {
    const phone = payload.whatsAppNumber || "";
    const cleaned = phone.startsWith("+65") ? phone.substring(3) : phone;
    const expiry = new Date(Date.now() + 30 * 60 * 1000);
    const f = `${expiry.getFullYear()}/${String(expiry.getMonth() + 1).padStart(2, "0")}/${String(expiry.getDate()).padStart(2, "0")} ${String(expiry.getHours()).padStart(2, "0")}:${String(expiry.getMinutes()).padStart(2, "0")}`;
    return `https://www.sgqrcode.com/paynow?mobile=${cleaned}&uen=&editable=0&amount=${amount.toFixed(2)}&expiry=${encodeURIComponent(f)}&ref_id=${encodeURIComponent(refId)}&company=`;
  };

  const prepareQR = async (amount: number, refId: string) => {
    if (country === "SG") return buildPayNow(amount, refId);
    if (payload.paymentURL) {
      const url = payload.paymentURL.startsWith("http")
        ? payload.paymentURL
        : `${apiURL}${payload.paymentURL}`;
      const upi = await extractUpiFromImage(url);
      if (upi) return buildUpi(upi, amount, refId);
    }
    return "";
  };

  const validate = (): string | null => {
    if (!firstName.trim() || !lastName.trim()) return "Name required";
    if (!whatsapp.trim() || whatsapp.length < 6) return "WhatsApp number required";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Invalid email";
    return null;
  };

  const handleContinue = async () => {
    if (!event) return;
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (totalPrice === 0) {
      await create();
      return;
    }
    if (!paymentMethod) {
      setError("Pick a payment method (Cash or QR).");
      return;
    }
    if (paymentMethod === "cash") {
      await create();
      return;
    }
    setQrPreparing(true);
    try {
      const refId = `evtsh-${shortRand(6)}-${shortRand(4)}`;
      const data = await prepareQR(totalPrice, refId);
      if (!data) {
        setError(
          "QR not configured — set PayNow phone (SG) or upload a payment QR image (UPI) first.",
        );
        return;
      }
      setQrPayload(data);
      setStep("qr_payment");
    } finally {
      setQrPreparing(false);
    }
  };

  const create = async () => {
    if (!event) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticketId = `evtsh-${shortRand(6)}-${shortRand(4)}`;
      const fullWhatsapp = `${dial}${whatsapp.replace(/\D/g, "")}`;
      const start = event.startDate ? new Date(event.startDate) : new Date();
      const dateStr = start.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const body = {
        ticketId,
        eventId: event.id,
        organizerId,
        tickets: [
          {
            type: effectiveType.name,
            quantity: 1,
            price: totalPrice,
          },
        ],
        customerDetails: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          whatsapp: fullWhatsapp,
        },
        total: totalPrice,
        paymentConfirmed: true,
        purchaseDate: new Date().toISOString(),
        eventInfo: {
          id: event.id,
          title: event.title,
          organizationName: payload.organizationName || "",
          venue: event.venue || "TBD",
          date: dateStr,
          time: event.time || "TBD",
          organizerId,
        },
      };
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/tickets/create-ticket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || `Failed (${res.status})`);
      }
      setConfirmation({
        ticketId,
        name: `${firstName.trim()} ${lastName.trim()}`,
        whatsapp: fullWhatsapp,
        email: email.trim() || undefined,
      });
      setStep("done");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────

  if (!payload.events.length) {
    return (
      <div className="mt-2 p-2 text-xs text-slate-500 italic">
        Nothing to book — create + publish an event first.
      </div>
    );
  }

  // Compact wrapper styled like other inline form bubbles
  const wrap = (children: React.ReactNode) => (
    <div className="mt-2 border rounded-lg bg-slate-50 p-2.5 max-w-md">
      {children}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );

  if (step === "done" && confirmation) {
    return wrap(
      <div className="bg-white border border-emerald-200 rounded-md p-3 text-center">
        <div className="mx-auto w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center mb-1.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <p className="text-xs font-semibold text-slate-900">Ticket booked</p>
        <p className="text-[10px] font-mono text-slate-500 mb-2">
          {confirmation.ticketId}
        </p>
        <div className="text-[11px] text-slate-700 text-left bg-slate-50 rounded p-2 space-y-0.5">
          <div>
            <span className="text-slate-500">Customer:</span>{" "}
            <span className="font-medium">{confirmation.name}</span>
          </div>
          <div>
            <span className="text-slate-500">WhatsApp:</span>{" "}
            <span className="font-medium">{confirmation.whatsapp}</span>
          </div>
          {confirmation.email && (
            <div>
              <span className="text-slate-500">Email:</span>{" "}
              <span className="font-medium">{confirmation.email}</span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          Sent to WhatsApp{confirmation.email ? " + email" : ""} with QR.
        </p>
      </div>,
    );
  }

  if (step === "qr_payment") {
    return wrap(
      <div className="bg-white border rounded-md p-3 text-center">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase mb-1.5">
          <QrCode className="h-3 w-3" />
          {country === "SG" ? "PayNow" : "UPI"}
        </div>
        <p className="text-[11px] text-slate-500">Customer scans</p>
        <p className="text-lg font-bold text-slate-900 mb-2">
          {sym}
          {totalPrice}
        </p>
        <div className="mx-auto w-fit bg-white p-2 border rounded">
          {qrPayload ? <QRCode value={qrPayload} size={170} level="M" /> : null}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1"
            onClick={() => setStep("customer")}
            disabled={submitting}
          >
            Back
          </Button>
          <Button
            size="sm"
            className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={create}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Paid
              </>
            )}
          </Button>
        </div>
      </div>,
    );
  }

  if (step === "customer" && event) {
    return wrap(
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
            onClick={() => setStep(event.visitorTypes.length > 1 ? "pick_type" : "pick_event")}
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
            Customer details
          </span>
        </div>
        <div className="border rounded-md p-2 bg-white flex items-center justify-between text-xs">
          <div className="truncate">
            <span className="font-semibold text-slate-800">{event.title}</span>
            <span className="text-slate-400"> · {effectiveType.name}</span>
          </div>
          <span
            className={`font-semibold ${totalPrice > 0 ? "text-slate-800" : "text-emerald-600"}`}
          >
            {totalPrice > 0 ? `${sym}${totalPrice}` : "FREE"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">First name *</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-8 text-xs"
              placeholder="John"
              disabled={submitting || qrPreparing}
            />
          </div>
          <div>
            <Label className="text-[10px]">Last name *</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-8 text-xs"
              placeholder="Doe"
              disabled={submitting || qrPreparing}
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px]">
            Email <span className="text-slate-400">(optional)</span>
          </Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-xs"
            placeholder="customer@example.com"
            type="email"
            disabled={submitting || qrPreparing}
          />
        </div>
        <div>
          <Label className="text-[10px]">WhatsApp *</Label>
          <div className="flex gap-1">
            <Select
              value={dial}
              onValueChange={setDial}
              disabled={submitting || qrPreparing}
            >
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="+91">+91</SelectItem>
                <SelectItem value="+65">+65</SelectItem>
                <SelectItem value="+1">+1</SelectItem>
                <SelectItem value="+44">+44</SelectItem>
                <SelectItem value="+971">+971</SelectItem>
                <SelectItem value="+61">+61</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))}
              className="h-8 text-xs flex-1"
              placeholder="9876543210"
              disabled={submitting || qrPreparing}
            />
          </div>
        </div>

        {/* Payment method when paid */}
        {totalPrice > 0 && (
          <div>
            <Label className="text-[10px] mb-1 block">Payment</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                disabled={submitting || qrPreparing}
                className={`flex items-center gap-1.5 p-1.5 rounded border text-left ${
                  paymentMethod === "cash"
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } disabled:opacity-50`}
              >
                <Banknote
                  className={`h-3.5 w-3.5 ${paymentMethod === "cash" ? "text-emerald-600" : "text-slate-500"}`}
                />
                <span className="text-[11px] font-semibold">Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("qr")}
                disabled={submitting || qrPreparing}
                className={`flex items-center gap-1.5 p-1.5 rounded border text-left ${
                  paymentMethod === "qr"
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                } disabled:opacity-50`}
              >
                <QrCode
                  className={`h-3.5 w-3.5 ${paymentMethod === "qr" ? "text-blue-600" : "text-slate-500"}`}
                />
                <span className="text-[11px] font-semibold">
                  QR ({country === "SG" ? "PayNow" : "UPI"})
                </span>
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded p-1.5">
            {error}
          </p>
        )}

        <Button
          size="sm"
          className="w-full h-9 bg-blue-600 hover:bg-blue-700"
          onClick={handleContinue}
          disabled={submitting || qrPreparing}
        >
          {submitting || qrPreparing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : totalPrice === 0 ? (
            "Book free ticket"
          ) : paymentMethod === "qr" ? (
            "Show QR"
          ) : paymentMethod === "cash" ? (
            "Confirm cash & book"
          ) : (
            "Continue"
          )}
        </Button>
      </div>,
    );
  }

  if (step === "pick_type" && event) {
    return wrap(
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
            onClick={() => setStep("pick_event")}
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
            Pick ticket type
          </span>
        </div>
        <p className="text-xs text-slate-700 font-medium truncate">
          {event.title}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {event.visitorTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTypeId(t.id);
                setStep("customer");
              }}
              className="border rounded p-1.5 text-left bg-white hover:border-blue-400 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-semibold truncate">
                  {t.name}
                </span>
                <span
                  className={`text-[11px] font-bold ${t.price > 0 ? "text-slate-800" : "text-emerald-600"}`}
                >
                  {t.price > 0 ? `${sym}${t.price}` : "FREE"}
                </span>
              </div>
              {t.description && (
                <p className="text-[9px] text-slate-400 line-clamp-2 mt-0.5">
                  {t.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>,
    );
  }

  // pick_event (default)
  return wrap(
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
          Pick event
        </span>
        <span className="text-[10px] text-slate-400">
          {payload.events.length} available
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
        {payload.events.map((ev) => {
          const types = ev.visitorTypes || [];
          const minPrice = types.length
            ? Math.min(...types.map((t) => t.price || 0))
            : 0;
          const start = ev.startDate ? new Date(ev.startDate) : null;
          return (
            <button
              key={ev.id}
              onClick={() => advanceFromEvent(ev.id)}
              className="w-full border rounded p-1.5 text-left bg-white hover:border-blue-400 hover:shadow-sm transition flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-800 truncate">
                  {ev.title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  {start && (
                    <span className="flex items-center gap-0.5">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {start.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                  {ev.venue && (
                    <span className="flex items-center gap-0.5 truncate">
                      <MapPin className="h-2.5 w-2.5" />
                      {ev.venue}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[11px] font-bold ${types.length === 0 ? "text-emerald-600" : "text-slate-800"}`}
                >
                  {types.length === 0
                    ? "FREE"
                    : `${sym}${minPrice}${types.length > 1 ? "+" : ""}`}
                </span>
                <Plus className="h-3 w-3 text-blue-500" />
              </div>
            </button>
          );
        })}
      </div>
    </div>,
  );
}
