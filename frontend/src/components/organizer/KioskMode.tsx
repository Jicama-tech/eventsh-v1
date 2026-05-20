import { useEffect, useState, useMemo, useRef } from "react";
import { jwtDecode } from "jwt-decode";
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
import { useToast } from "@/hooks/use-toast";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountryCodes } from "@/hooks/useCountryCodes";
import { buildPayNowQrUrl } from "@/lib/paynowQr";
import {
  Monitor,
  CalendarDays,
  MapPin,
  Ticket as TicketIcon,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Sparkles,
  Banknote,
  QrCode,
  Search,
  Plus,
} from "lucide-react";

const apiURL = __API_URL__;

interface VisitorType {
  id: string;
  name: string;
  price: number;
  maxCount?: number;
  description?: string;
}

interface KioskEvent {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  time?: string;
  location?: string;
  venue?: string;
  status?: string;
  visibility?: string;
  visitorTypes?: VisitorType[];
  totalTickets?: number;
}

type Step =
  | "events_list"
  | "select_type"
  | "customer_form"
  | "qr_payment"
  | "confirmation";

type PaymentMethod = "cash" | "qr" | null;

interface OrganizerInfo {
  organizationName?: string;
  country?: string;
  whatsAppNumber?: string;
  paymentURL?: string;
}

const FREE_ENTRY_TYPE: VisitorType = {
  id: "free_entry",
  name: "Free Entry",
  price: 0,
};

function shortRand(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function KioskMode() {
  const { toast } = useToast();
  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);
  const { countries } = useCountryCodes();

  const [step, setStep] = useState<Step>("events_list");
  const [events, setEvents] = useState<KioskEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<KioskEvent | null>(null);
  const [selectedType, setSelectedType] = useState<VisitorType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    ticketId: string;
    customerName: string;
    whatsapp: string;
    email?: string;
  } | null>(null);

  // Customer form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappCountryCode, setWhatsappCountryCode] = useState(
    country === "IN" ? "+91" : country === "SG" ? "+65" : "+91",
  );
  const [whatsappNumber, setWhatsappNumber] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [organizerInfo, setOrganizerInfo] = useState<OrganizerInfo | null>(
    null,
  );
  const [qrPayload, setQrPayload] = useState("");
  const [qrPreparing, setQrPreparing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const organizerId = useMemo(() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return "";
      const decoded: any = jwtDecode(token);
      return decoded?.sub || "";
    } catch {
      return "";
    }
  }, []);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/organizers/dashboard-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      // Show only upcoming + currently-running events that are published.
      const upcoming = [
        ...(data.currentEvents || []),
        ...(data.upcomingEvents || []),
      ].filter(
        (e: any) =>
          (e.status === "published" || !e.status) &&
          e.visibility !== "private",
      );
      setEvents(upcoming);
    } catch (e: any) {
      toast({
        title: "Couldn't load events",
        description: e?.message || "Try refreshing.",
        variant: "destructive",
      });
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  // Pull organizer payment info (paymentURL for UPI extraction, country, phone).
  useEffect(() => {
    if (!organizerId) return;
    (async () => {
      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(
          `${apiURL}/organizers/profile-get/${organizerId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data || json;
        if (data) setOrganizerInfo(data);
      } catch {
        /* non-fatal — QR option just falls back to generic message */
      }
    })();
  }, [organizerId]);

  // Build a `upi://pay?...` URL by extracting the UPI ID from the organizer's
  // payment QR image and re-signing it with the kiosk amount + ticketId.
  const extractUpiFromImage = (imageUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("");
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(data.data, canvas.width, canvas.height);
        if (code?.data?.includes("upi://pay")) {
          const m = code.data.match(/pa=([^&]+)/);
          resolve(m?.[1] || "");
        } else {
          resolve("");
        }
      };
      img.onerror = () => resolve("");
      img.src = imageUrl;
    });

  const buildUpiUrl = (upi: string, amount: number, refId: string) =>
    `upi://pay?pa=${upi}&pn=${encodeURIComponent(
      organizerInfo?.organizationName || "Payment",
    )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
      `Ticket - ${refId}`,
    )}`;

  const buildPayNowUrl = (amount: number, refId: string) => {
    // UEN-first; fall back to PayNow mobile / WhatsApp number. Kiosk QRs
    // expire after 30 minutes (in-person sessions, not 90h like the
    // remote-checkout flows).
    return (
      buildPayNowQrUrl({
        organizer: {
          UENNumber: organizerInfo?.UENNumber,
          payNowId:
            organizerInfo?.payNowId || organizerInfo?.whatsAppNumber || "",
        },
        amount: Number(amount.toFixed(2)),
        refId,
        expiry: new Date(Date.now() + 30 * 60 * 1000),
      }) || ""
    );
  };

  const prepareQRPayload = async (amount: number, refId: string) => {
    const orgCountry = (organizerInfo?.country || country || "").toUpperCase();
    if (orgCountry === "SG") {
      return buildPayNowUrl(amount, refId);
    }
    // Default to UPI extraction (India + others using UPI image)
    if (organizerInfo?.paymentURL) {
      const url = organizerInfo.paymentURL.startsWith("http")
        ? organizerInfo.paymentURL
        : `${apiURL}${organizerInfo.paymentURL}`;
      const upi = await extractUpiFromImage(url);
      if (upi) return buildUpiUrl(upi, amount, refId);
    }
    return "";
  };

  const goEvents = () => {
    setStep("events_list");
    setSelectedEvent(null);
    setSelectedType(null);
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setWhatsappNumber("");
    setPaymentMethod(null);
    setQrPayload("");
  };

  // Validation shared by both Cash and QR paths.
  const validateForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Name required",
        description: "Enter both first and last name.",
        variant: "destructive",
      });
      return false;
    }
    if (!whatsappNumber.trim() || whatsappNumber.length < 6) {
      toast({
        title: "WhatsApp number required",
        description: "Enter a valid number — the ticket is sent there.",
        variant: "destructive",
      });
      return false;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({
        title: "Invalid email",
        description: "Email is optional, but if entered must be valid.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const pickEvent = (ev: KioskEvent) => {
    setSelectedEvent(ev);
    const types = ev.visitorTypes || [];
    if (types.length === 0) {
      // Free entry path
      setSelectedType({ ...FREE_ENTRY_TYPE });
      setStep("customer_form");
    } else if (types.length === 1) {
      setSelectedType(types[0]);
      setStep("customer_form");
    } else {
      setStep("select_type");
    }
  };

  const pickType = (t: VisitorType) => {
    setSelectedType(t);
    setStep("customer_form");
  };

  // Step 1: customer clicks "Continue". If price = 0 → submit ticket directly.
  // If price > 0 → require payment method choice. Cash → submit ticket. QR →
  // generate QR + go to qr_payment screen.
  const handleContinue = async () => {
    if (!selectedEvent || !selectedType) return;
    if (!validateForm()) return;
    const price = Number(selectedType.price) || 0;
    if (price === 0) {
      await createTicket();
      return;
    }
    if (!paymentMethod) {
      toast({
        title: "Pick a payment method",
        description: "Cash or QR — how is the customer paying?",
        variant: "destructive",
      });
      return;
    }
    if (paymentMethod === "cash") {
      await createTicket();
      return;
    }
    // QR path — generate payload then move to qr_payment view.
    setQrPreparing(true);
    try {
      const refId = `evtsh-${shortRand(6)}-${shortRand(4)}`;
      const payload = await prepareQRPayload(price, refId);
      if (!payload) {
        toast({
          title: "QR not configured",
          description:
            "Upload a payment QR (UPI image) or set your PayNow phone in Settings → Payments first.",
          variant: "destructive",
        });
        setQrPreparing(false);
        return;
      }
      setQrPayload(payload);
      setStep("qr_payment");
    } finally {
      setQrPreparing(false);
    }
  };

  // Final step — write ticket to backend, send to customer's WhatsApp + email.
  const createTicket = async () => {
    if (!selectedEvent || !selectedType) return;
    setSubmitting(true);
    try {
      const ticketId = `evtsh-${shortRand(6)}-${shortRand(4)}`;
      const fullWhatsapp = `${whatsappCountryCode}${whatsappNumber.replace(/^\+?\d*?(\d+)$/, "$1")}`;
      const startDate = selectedEvent.startDate
        ? new Date(selectedEvent.startDate)
        : new Date();
      const dateStr = startDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const timeStr = selectedEvent.time || "TBD";
      const venue = selectedEvent.venue || selectedEvent.location || "TBD";

      const body = {
        ticketId,
        eventId: selectedEvent._id,
        organizerId,
        tickets: [
          {
            type: selectedType.name,
            quantity: 1,
            price: selectedType.price || 0,
          },
        ],
        customerDetails: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          whatsapp: fullWhatsapp,
        },
        total: selectedType.price || 0,
        paymentConfirmed: true,
        purchaseDate: new Date().toISOString(),
        eventInfo: {
          id: selectedEvent._id,
          title: selectedEvent.title,
          organizationName: "",
          venue,
          date: dateStr,
          time: timeStr,
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
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed (${res.status})`);
      }

      setConfirmation({
        ticketId,
        customerName: `${firstName.trim()} ${lastName.trim()}`,
        whatsapp: fullWhatsapp,
        email: email.trim() || undefined,
      });
      setStep("confirmation");
    } catch (e: any) {
      toast({
        title: "Couldn't book ticket",
        description: e?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    resetForm();
    setConfirmation(null);
    goEvents();
  };

  // ─── Render ─────────────────────────────────────────────────────────

  const crumbs: Record<Step, string> = {
    events_list: "Pick an event",
    select_type: "Pick ticket type",
    customer_form: "Customer details",
    qr_payment: "QR payment",
    confirmation: "Done",
  };

  const Header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 text-slate-600" />
        <h2 className="text-xl font-bold text-slate-800">Walk-in Booking</h2>
        <span className="text-slate-300 mx-1">›</span>
        <span className="text-sm text-slate-500">{crumbs[step]}</span>
      </div>
      {step !== "events_list" && step !== "confirmation" && (
        <Button variant="outline" size="sm" onClick={goEvents}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
      )}
    </div>
  );

  if (step === "events_list") {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? events.filter(
          (e) =>
            (e.title || "").toLowerCase().includes(q) ||
            (e.venue || e.location || "").toLowerCase().includes(q),
        )
      : events;

    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {Header}
        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {loadingEvents ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
            <CalendarDays className="h-8 w-8 mb-2" />
            <p className="text-sm">
              {events.length === 0
                ? "No upcoming events"
                : "No events match your search"}
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filtered.map((ev) => {
                const types = ev.visitorTypes || [];
                const minPrice = types.length
                  ? Math.min(...types.map((t) => Number(t.price) || 0))
                  : 0;
                const start = ev.startDate ? new Date(ev.startDate) : null;
                return (
                  <div
                    key={ev._id}
                    className="border rounded-lg p-2 bg-white hover:shadow-sm transition-shadow flex flex-col"
                  >
                    <p className="text-xs font-medium text-slate-800 truncate">
                      {ev.title}
                    </p>
                    {start && (
                      <p className="text-[10px] text-slate-400 truncate">
                        {start.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                        {ev.time ? ` · ${ev.time}` : ""}
                      </p>
                    )}
                    {(ev.venue || ev.location) && (
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {ev.venue || ev.location}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-1.5">
                      <div>
                        <span
                          className={`text-xs font-semibold ${
                            types.length === 0
                              ? "text-emerald-600"
                              : "text-slate-800"
                          }`}
                        >
                          {types.length === 0
                            ? "FREE"
                            : `${getSymbol()}${minPrice}${types.length > 1 ? "+" : ""}`}
                        </span>
                        {types.length > 1 && (
                          <span className="text-[10px] text-slate-400 block">
                            {types.length} types
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => pickEvent(ev)}
                      >
                        <Plus className="h-3 w-3 mr-0.5" />
                        Book
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === "select_type" && selectedEvent) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {Header}
        <p className="text-xs text-slate-500 mb-3">
          <span className="font-semibold text-slate-700">
            {selectedEvent.title}
          </span>
        </p>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {(selectedEvent.visitorTypes || []).map((t) => (
              <div
                key={t.id}
                className="border rounded-lg p-2 bg-white hover:shadow-sm transition-shadow flex flex-col"
              >
                <p className="text-xs font-medium text-slate-800 truncate">
                  {t.name}
                </p>
                {t.description && (
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                    {t.description}
                  </p>
                )}
                {typeof t.maxCount === "number" && t.maxCount > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {t.maxCount} left
                  </p>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    className={`text-xs font-semibold ${
                      Number(t.price) > 0 ? "text-slate-800" : "text-emerald-600"
                    }`}
                  >
                    {Number(t.price) > 0
                      ? `${getSymbol()}${t.price}`
                      : "FREE"}
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => pickType(t)}
                  >
                    <Plus className="h-3 w-3 mr-0.5" />
                    Pick
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "customer_form" && selectedEvent && selectedType) {
    const totalPrice = Number(selectedType.price) || 0;
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {Header}
        <div className="flex-1 overflow-y-auto w-full">
          {/* Selection summary */}
          <div className="border rounded-lg p-2.5 mb-3 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800 truncate">
                {selectedEvent.title}
              </p>
              <p className="text-[10px] text-slate-500">{selectedType.name}</p>
            </div>
            <span
              className={`text-sm font-semibold ${
                totalPrice > 0 ? "text-slate-800" : "text-emerald-600"
              }`}
            >
              {totalPrice > 0 ? `${getSymbol()}${totalPrice}` : "FREE"}
            </span>
          </div>

          {/* Customer form */}
          <div className="space-y-3 bg-white border rounded-lg p-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="kiosk-fname">First name *</Label>
                <Input
                  id="kiosk-fname"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kiosk-lname">Last name *</Label>
                <Input
                  id="kiosk-lname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="kiosk-email">
                Email{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="kiosk-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                disabled={submitting}
              />
              <p className="text-[10px] text-slate-500">
                If provided, the ticket is also emailed.
              </p>
            </div>

            <div className="space-y-1">
              <Label>WhatsApp number *</Label>
              <div className="flex gap-2">
                <Select
                  value={whatsappCountryCode}
                  onValueChange={setWhatsappCountryCode}
                  disabled={submitting}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.dialCode}>
                        {c.code} {c.dialCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) =>
                    setWhatsappNumber(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="9876543210"
                  disabled={submitting}
                  className="flex-1"
                />
              </div>
              <p className="text-[10px] text-slate-500">
                The ticket QR code is sent here.
              </p>
            </div>

            {/* Payment method — only when ticket has a price */}
            {totalPrice > 0 && (
              <div className="pt-2 border-t">
                <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Payment method
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={submitting || qrPreparing}
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center gap-2 p-2.5 rounded-md border transition text-left ${
                      paymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } disabled:opacity-50`}
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${
                        paymentMethod === "cash"
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Banknote className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Cash
                      </div>
                      <div className="text-[10px] text-slate-500">
                        At counter
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled={submitting || qrPreparing}
                    onClick={() => setPaymentMethod("qr")}
                    className={`flex items-center gap-2 p-2.5 rounded-md border transition text-left ${
                      paymentMethod === "qr"
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    } disabled:opacity-50`}
                  >
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center ${
                        paymentMethod === "qr"
                          ? "bg-blue-500 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <QrCode className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        QR
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {(organizerInfo?.country || "").toUpperCase() === "SG"
                          ? "PayNow"
                          : "UPI"}
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={goEvents}
                disabled={submitting || qrPreparing}
                className="h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleContinue}
                disabled={submitting || qrPreparing}
                className="h-9 bg-blue-600 hover:bg-blue-700 font-semibold sm:min-w-[160px]"
              >
                {submitting || qrPreparing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {qrPreparing ? "Preparing QR…" : "Booking…"}
                  </>
                ) : totalPrice === 0 ? (
                  <>
                    <TicketIcon className="h-3.5 w-3.5 mr-1.5" />
                    Book free ticket
                  </>
                ) : paymentMethod === "cash" ? (
                  <>
                    <Banknote className="h-3.5 w-3.5 mr-1.5" />
                    Confirm cash & book
                  </>
                ) : paymentMethod === "qr" ? (
                  <>
                    <QrCode className="h-3.5 w-3.5 mr-1.5" />
                    Show QR
                  </>
                ) : (
                  <>
                    <TicketIcon className="h-3.5 w-3.5 mr-1.5" />
                    Continue
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "qr_payment" && selectedEvent && selectedType) {
    const totalPrice = Number(selectedType.price) || 0;
    const orgCountry = (organizerInfo?.country || country || "").toUpperCase();
    const methodLabel = orgCountry === "SG" ? "PayNow" : "UPI";
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {Header}
        <div className="flex-1 flex items-start justify-center pt-2 overflow-y-auto">
          <div className="max-w-sm w-full bg-white border rounded-lg p-4 text-center">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wide mb-2">
              <QrCode className="h-3 w-3" />
              {methodLabel}
            </div>
            <p className="text-xs text-slate-500">Customer scans to pay</p>
            <p className="text-2xl font-bold text-slate-900 mb-3">
              {getSymbol()}
              {totalPrice}
            </p>
            <div className="mx-auto w-fit bg-white p-3 border rounded-lg">
              {qrPayload ? (
                <QRCode value={qrPayload} size={200} level="M" />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-slate-400 text-xs">
                  No QR
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 truncate">
              {selectedEvent.title} · {selectedType.name}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex-1"
                onClick={() => setStep("customer_form")}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                size="sm"
                className="h-9 flex-1 bg-emerald-600 hover:bg-emerald-700 font-semibold"
                onClick={createTicket}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Booking…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Paid · Generate ticket
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    );
  }

  if (step === "confirmation" && confirmation) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        {Header}
        <div className="flex-1 flex items-start justify-center pt-2">
          <div className="max-w-sm w-full bg-white border rounded-lg p-4 text-center">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-0.5">
              Ticket booked
            </h2>
            <div className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono mb-3">
              {confirmation.ticketId}
            </div>
            <div className="text-xs text-slate-700 space-y-1.5 text-left border rounded-md p-2.5 bg-slate-50">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium text-right">
                  {confirmation.customerName}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">WhatsApp</span>
                <span className="font-medium text-right">
                  {confirmation.whatsapp}
                </span>
              </div>
              {confirmation.email && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Email</span>
                  <span className="font-medium text-right break-all">
                    {confirmation.email}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-2 inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Sent to WhatsApp{confirmation.email ? " + email" : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("events_list")}
                className="h-9 flex-1"
              >
                Done
              </Button>
              <Button
                size="sm"
                onClick={handleBookAnother}
                className="h-9 flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Book another
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
