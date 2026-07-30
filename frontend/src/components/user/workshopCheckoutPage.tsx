import { useState, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ArrowLeft,
  GraduationCap,
  Package,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountryCodes } from "@/hooks/useCountryCodes";

interface WorkshopSelection {
  eventId: string;
  organizerId: string;
  eventTitle: string;
  bookingType: "session" | "package";
  sessionId?: string;
  packageId?: string;
  name: string;
  description?: string;
  unitPrice: number;
  seatsRemaining: number | null;
  included?: string[];
}

// Persisted across the Google OAuth round trip — window.location.href
// navigates fully away and back, so React Router's location.state (which
// is all we get from the eventfront's navigate() call) doesn't survive it.
// Same pattern ticketCart.tsx uses for its cart.
const STORAGE_KEY = "workshopCheckout";
const CART_COUNTRY_KEY = "cart:country";

const apiURL = __API_URL__;

const WorkshopCheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { countries } = useCountryCodes();

  const [item, setItem] = useState<WorkshopSelection | null>(() => {
    if (location.state) return location.state as WorkshopSelection;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (location.state) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(location.state));
    }
  }, [location.state]);

  // Workshops are booked one at a time — no quantity stepper.
  const quantity = 1;

  // Customer details
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isNameDisabled, setIsNameDisabled] = useState(false);
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [whatsapp, setWhatsapp] = useState("");

  // Persist/restore currency country across the Google redirect, same key
  // ticketCart uses, so the price display doesn't flash to a fallback.
  const [country, setCountry] = useState<string>(
    () => sessionStorage.getItem(CART_COUNTRY_KEY) || "",
  );
  useEffect(() => {
    if (country) sessionStorage.setItem(CART_COUNTRY_KEY, country);
  }, [country]);
  const { formatPrice } = useCurrency(country);

  const [loading, setLoading] = useState(false);

  // Google Auth state
  const [googleAuthed, setGoogleAuthed] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState("");

  useEffect(() => {
    if (!item?.organizerId) return;
    fetch(`${apiURL}/organizers/profile-get/${item.organizerId}`)
      .then((r) => r.json())
      .then((result) => setCountry(result?.data?.country || ""))
      .catch(() => undefined);
  }, [item?.organizerId]);

  // Handle Google auth redirect callback — mirrors ticketCart.tsx exactly.
  useEffect(() => {
    const googleAuth = searchParams.get("google_auth");
    if (googleAuth === "success") {
      const gEmail = searchParams.get("email") || "";
      const gFirstName = searchParams.get("firstName") || "";
      const gLastName = searchParams.get("lastName") || "";
      const gName = searchParams.get("name") || "";
      const isExisting = searchParams.get("existing") === "true";

      setEmail(gEmail);
      setEmailVerified(true);
      setGoogleAuthed(true);

      if (isExisting) {
        fetchUserByEmail(gEmail).then((existingUser) => {
          const fn =
            existingUser?.firstName || gFirstName || gName.split(" ")[0] || "";
          const ln =
            existingUser?.lastName ||
            gLastName ||
            gName.split(" ").slice(1).join(" ") ||
            "";
          setFirstName(fn);
          setLastName(ln);
          setIsNameDisabled(!!(fn || ln));
          if (existingUser?.whatsAppNumber) {
            setPendingWhatsApp(existingUser.whatsAppNumber);
          }
          toast({
            duration: 3000,
            title: "Welcome back!",
            description: "Your details have been auto-filled",
          });
        });
      } else {
        const fn = gFirstName || gName.split(" ")[0] || "";
        const ln = gLastName || gName.split(" ").slice(1).join(" ") || "";
        setFirstName(fn);
        setLastName(ln);
        setIsNameDisabled(false);
        toast({
          duration: 3000,
          title: "Signed in with Google",
          description: "Please complete your details",
        });
      }

      searchParams.delete("google_auth");
      searchParams.delete("email");
      searchParams.delete("firstName");
      searchParams.delete("lastName");
      searchParams.delete("name");
      searchParams.delete("existing");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("error") === "auth_failed") {
      toast({
        duration: 3000,
        title: "Google Sign-in Failed",
        description: "Please try again or enter details manually",
        variant: "destructive",
      });
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    // Selection is already mirrored to sessionStorage above, so it survives
    // this full-page redirect out to Google and back.
    const returnUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `${apiURL}/auth/google-buyer?state=${returnUrl}`;
  };

  async function fetchUserByEmail(emailToLookup: string) {
    if (!emailToLookup) return null;
    try {
      const res = await fetch(`${apiURL}/users/get-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToLookup }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && data.user) {
        const nameStr = String(data.user.name || "").trim();
        const nameParts = nameStr.split(/\s+/);
        const uFirstName = data.user.firstName || nameParts[0] || "";
        const uLastName = data.user.lastName || nameParts.slice(1).join(" ") || "";
        return {
          firstName: uFirstName,
          lastName: uLastName,
          whatsAppNumber: data.user.whatsAppNumber || "",
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  // Split a stored "+919876543210" into countryCode + local digits once the
  // countries list is available — same longest-dial-code-first match as
  // ticketCart.tsx.
  useEffect(() => {
    if (!pendingWhatsApp) return;
    const codeList = countries
      .map((c) => c.dialCode)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    const match = codeList.find((dc) => pendingWhatsApp.startsWith(dc));
    if (match) {
      setCountryCode(match);
      setWhatsapp(pendingWhatsApp.slice(match.length).replace(/\D/g, ""));
    } else {
      setWhatsapp(pendingWhatsApp.replace(/^\+/, "").replace(/\D/g, ""));
    }
    setPendingWhatsApp("");
  }, [pendingWhatsApp, countries]);

  // Watch email changes to auto-populate names for a returning visitor.
  useEffect(() => {
    if (googleAuthed) return;
    async function lookupUser() {
      if (!email || !emailVerified) return;
      const user = await fetchUserByEmail(email);
      if (user && (user.firstName || user.lastName)) {
        setFirstName(user.firstName);
        setLastName(user.lastName);
        setIsNameDisabled(true);
      }
    }
    lookupUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, emailVerified, googleAuthed]);

  async function handleVerifyEmail() {
    if (!email) {
      toast({ title: "Please enter email", variant: "destructive" });
      return;
    }
    setEmailVerifying(true);
    try {
      const res = await fetch(`${apiURL}/users/verify-email-for-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          whatsAppNumber: whatsapp ? `${countryCode}${whatsapp}` : "",
        }),
      });
      if (!res.ok) throw new Error("Failed to verify email");
      const data = await res.json();
      if (data.success) {
        setEmailVerified(true);
        setFirstName(data.user.name.split(" ")[0] || "");
        setLastName(data.user.name.split(" ").slice(1).join(" "));
        toast({ title: "Email Verified", description: data.message });
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setEmailVerifying(false);
    }
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 mb-4">No workshop selected.</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft size={16} className="mr-2" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const total = item.unitPrice * quantity;

  const handleProceed = async () => {
    if (!email || !emailVerified) {
      toast({
        title: "Missing details",
        description: "Please verify your email before proceeding.",
        variant: "destructive",
      });
      return;
    }
    if (!whatsapp) {
      toast({
        title: "Missing details",
        description: "Please enter your WhatsApp number.",
        variant: "destructive",
      });
      return;
    }
    if (!firstName || !lastName) {
      toast({
        title: "Missing details",
        description: "Please fill in first name and last name.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiURL}/workshop-bookings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: item.eventId,
          organizerId: item.organizerId,
          bookingType: item.bookingType,
          sessionId: item.sessionId,
          packageId: item.packageId,
          quantity,
          visitorName: `${firstName} ${lastName}`.trim(),
          visitorEmail: email,
          visitorPhone: `${countryCode}${whatsapp}`,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast({
          title: "Booking failed",
          description: result.message,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      navigate("/workshop-payment", {
        state: {
          bookings: [result.data],
          eventTitle: item.eventTitle,
          totalAmount: result.data.amount,
          organizerId: item.organizerId,
        },
      });
    } catch (err: any) {
      toast({
        title: "Booking failed",
        description: err.message,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Workshop Checkout</h1>
            <p className="text-sm text-gray-500">{item.eventTitle}</p>
          </div>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {item.bookingType === "package" ? (
                <Package className="h-4 w-4 text-indigo-500" />
              ) : (
                <GraduationCap className="h-4 w-4 text-blue-500" />
              )}
              {item.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {item.description && (
              <p className="text-sm text-gray-600">{item.description}</p>
            )}
            {item.included && item.included.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.included.map((n) => (
                  <Badge key={n} variant="secondary" className="text-xs">
                    {n}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {item.unitPrice === 0 ? "Free" : formatPrice(item.unitPrice)}
                  <span className="text-gray-400 font-normal"> / person</span>
                </p>
                {item.seatsRemaining != null && (
                  <p className="text-xs text-gray-400">
                    {item.seatsRemaining} seat(s) left
                  </p>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">
                Qty 1
              </Badge>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-bold text-gray-800">Total Amount</span>
              <span className="font-bold text-lg text-blue-600">{formatPrice(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Customer Details — same Google-auth-first pattern as ticketCart.tsx,
            so this page (and any future checkout that needs a buyer identity)
            can reuse it without re-deriving the flow. */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Your Details (To Be Printed On Ticket)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!googleAuthed && (
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  {googleLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {googleLoading ? "Signing in..." : "Sign in with Google"}
                  </span>
                </button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      or continue manually
                    </span>
                  </div>
                </div>
              </div>
            )}

            {googleAuthed && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm text-green-700 font-medium">Signed in as {email}</span>
              </div>
            )}

            {/* WhatsApp Number — mandatory, no OTP verification (same as ticketCart.tsx). */}
            <div>
              <Label className="mb-2 block">WhatsApp Number *</Label>
              <div className="flex items-center space-x-2">
                <div className="w-28">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Code" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.code} value={c.dialCode}>
                          {c.name} {c.dialCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="tel"
                  placeholder="Enter number"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ""))}
                  required
                  className="flex-grow"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <Label className="flex items-center justify-between mb-2">
                <span>Email Address *</span>
                {emailVerified && <Badge variant="default">Verified</Badge>}
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailVerified(false);
                  }}
                  disabled={emailVerified}
                  className="flex-grow"
                />
                {!emailVerified && (
                  <Button
                    onClick={handleVerifyEmail}
                    disabled={emailVerifying || email === ""}
                    size="sm"
                    variant="buttonOutline"
                  >
                    {emailVerifying ? "Verifying..." : "Verify"}
                  </Button>
                )}
              </div>
            </div>

            {/* First / Last Name */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2">First Name *</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  disabled={isNameDisabled}
                />
              </div>
              <div>
                <Label className="mb-2">Last Name *</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  disabled={isNameDisabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full py-6 text-base font-bold rounded-xl"
          onClick={handleProceed}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" /> Processing...
            </>
          ) : (
            `Proceed to Payment — ${formatPrice(total)}`
          )}
        </Button>
      </div>
    </div>
  );
};

export default WorkshopCheckoutPage;
