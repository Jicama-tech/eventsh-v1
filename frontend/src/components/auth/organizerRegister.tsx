import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Globe, Mail, MessageCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { COUNTRIES } from "@/data/countries";

export function OrganizerRegister() {
  const apiURL = __API_URL__;
  const navigate = useNavigate();
  const location = useLocation();
  // Accept name/email either from router state (legacy in-app navigation) or
  // from URL query params (Google OAuth backend redirect).
  const queryParams = (() => {
    try {
      return new URLSearchParams(location.search);
    } catch {
      return new URLSearchParams();
    }
  })();
  const stateInitial = (location.state || {}) as {
    name?: string;
    email?: string;
    whatsAppNumber?: string;
  };
  const initialName = stateInitial.name || queryParams.get("name") || "";
  const initialEmail = stateInitial.email || queryParams.get("email") || "";
  const initialWhatsApp =
    stateInitial.whatsAppNumber || queryParams.get("whatsAppNumber") || "";
  const { toast } = useToast();

  // Capture agent referral code from ?ref=CODE in URL
  const initialReferralCode = queryParams.get("ref") || "";
  const [agentReferralCode, setAgentReferralCode] =
    useState(initialReferralCode);

  // Country selection
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const currentCountry = selectedCountry
    ? COUNTRIES.find((c) => c.code === selectedCountry)
    : null;

  // Profile state — initial values are pre-filled from the URL params that
  // the Google → Individual onboarding flow attaches (?name=…&email=…). The
  // business email is seeded to the same Google address as a convenience;
  // the user can change it before they hit "Send OTP".
  const [profile, setProfile] = useState({
    name: initialName,
    organizationName: "",
    email: initialEmail,
    businessEmail: initialEmail,
    phone: "",
    whatsAppNumber: initialWhatsApp,
    address: "",
    bio: "",
    country: "",
  });

  // Email OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // WhatsApp is captured as the login identifier but is NOT OTP-verified at
  // registration anymore (email-first). Login still uses a WhatsApp OTP.

  // General loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    // Seed BOTH the WhatsApp and phone fields with the selected country's dial
    // code (digits only — react-phone-input-2's expected value format). The
    // keyed PhoneInputs below remount on country change so the visible code
    // prefix updates too, not just this seeded value.
    const dial = COUNTRIES.find((c) => c.code === code)?.dialCode || "";
    const dialDigits = dial.replace(/\D/g, "");
    setProfile((prev) => ({
      ...prev,
      country: code,
      whatsAppNumber: dialDigits,
      phone: dialDigits,
    }));
  };

  const handleChange = (field: string, value: any) => {
    if (field === "businessEmail") {
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
      setOtpError("");
    }

    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  // Email OTP handlers
  const sendOtpToBusinessEmail = async () => {
    if (!profile.businessEmail) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Business email is required",
      });
      return;
    }

    try {
      setSendingOtp(true);
      const token = sessionStorage.getItem("token");
      const response = await fetch(`${apiURL}/otp/send-business-email-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessEmail: profile.businessEmail }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send OTP");
      }

      setOtpSent(true);
      setOtpError("");
      toast({
        duration: 5000,
        title: "OTP Sent",
        description: "OTP sent to your business email",
      });
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Failed to send OTP",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtpForBusinessEmail = async () => {
    if (!otp || otp.length < 4) {
      setOtpError("Please enter a valid OTP");
      return;
    }

    try {
      setVerifyingOtp(true);
      const token = sessionStorage.getItem("token");
      const response = await fetch(`${apiURL}/otp/verify-business-email-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ businessEmail: profile.businessEmail, otp }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid OTP");
      }

      setEmailVerified(true);
      setOtpError("");
      toast({
        duration: 5000,
        title: "Verified",
        description: "Business email verified",
      });
    } catch (error: any) {
      setOtpError(error.message);
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailVerified) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please verify your business email",
        variant: "destructive",
      });
      return;
    }

    if (!profile.whatsAppNumber || profile.whatsAppNumber.length < 8) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please enter your WhatsApp number (used for login).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, any> = {
        name: profile.name,
        email: profile.email,
        phone: profile.phone.startsWith("+")
          ? profile.phone
          : `+${profile.phone}`,
        address: profile.address,
        organizationName: profile.organizationName,
        businessEmail: profile.businessEmail,
        whatsAppNumber: profile.whatsAppNumber.startsWith("+")
          ? profile.whatsAppNumber
          : `+${profile.whatsAppNumber}`,
        bio: profile.bio,
        country: profile.country,
        role: "organizer",
        // This form is the full Organizer signup. Individuals never reach
        // it (Google sign-in -> chatbot-only dashboard -> lazy-create
        // Individual organizer on first event publish handles them).
        accountType: "Organizer",
      };

      if (agentReferralCode) {
        payload.agentReferralCode = agentReferralCode.trim();
      }

      const response = await fetch(`${apiURL}/organizers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Registration failed");
      }

      toast({
        duration: 5000,
        title: "Registration Success",
        description:
          "Your account is active and the starter plan is assigned. Please log in to continue.",
      });
      // The user may still be holding an "individual"-role JWT (Google
      // onboarding flow). Drop it so the authenticated route table swaps
      // back to the unauthenticated one and /organizer/login renders. A
      // hard reload guarantees the auth context re-initializes from the
      // (now empty) sessionStorage instead of holding the stale user.
      sessionStorage.removeItem("token");
      window.location.href = "/organizer/login";
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Registration failed",
        duration: 5000,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormBlurred = !selectedCountry;
  const shouldDisableFollowingFields = !emailVerified;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Organizer Registration</CardTitle>
          <CardDescription>
            Register your organization to manage events and venues.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Account-type selector removed: this form IS the organizer
              registration path. Individuals don't reach it — they sign in
              with Google and get a lazy-created Individual organizer on
              first event publish. Anyone filling out this multi-field
              form is signing up as a full Organizer (accountType is
              hardcoded to "Organizer" in the payload below). */}

          <div className="grid gap-2 mb-6">
            <Label htmlFor="country" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Country <span className="text-red-600">*</span>
            </Label>
            <Select
              value={selectedCountry || ""}
              onValueChange={handleCountryChange}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name} ({country.dialCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <form
            onSubmit={handleSubmit}
            className={`space-y-6 transition-opacity duration-300 ${
              isFormBlurred ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {/* Business Email with OTP */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="businessEmail"
                  className="flex items-center gap-2"
                >
                  <Mail className="w-4 h-4 text-gray-600" />
                  Business Email <span className="text-red-600">*</span>
                </Label>
                {emailVerified && (
                  <Badge className="bg-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" /> Verified
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="businessEmail"
                  type="email"
                  value={profile.businessEmail}
                  onChange={(e) =>
                    handleChange("businessEmail", e.target.value)
                  }
                  placeholder="business@example.com"
                />
                <Button
                  type="button"
                  onClick={sendOtpToBusinessEmail}
                  disabled={
                    sendingOtp || !profile.businessEmail || emailVerified
                  }
                >
                  {sendingOtp
                    ? "Sending..."
                    : emailVerified
                      ? "Verified"
                      : "Send OTP"}
                </Button>
              </div>
              {otpSent && !emailVerified && (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                  />
                  <Button
                    type="button"
                    onClick={verifyOtpForBusinessEmail}
                    disabled={verifyingOtp}
                  >
                    {verifyingOtp ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              )}
              {otpError && <p className="text-sm text-red-600">{otpError}</p>}
            </div>

            {/* WhatsApp Number — a contact number only. Not used for login and
                not OTP-verified here (email-first). */}
            <div className="grid gap-2">
              <Label
                htmlFor="whatsAppNumber"
                className="flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-green-600" />
                WhatsApp Number ({currentCountry?.dialCode}){" "}
                <span className="text-red-600">*</span>
              </Label>
              <PhoneInput
                key={`wa-${selectedCountry || "in"}`}
                country={selectedCountry?.toLowerCase() || "in"}
                value={profile.whatsAppNumber}
                onChange={(value) => handleChange("whatsAppNumber", value)}
                disabled={!emailVerified}
                onlyCountries={
                  selectedCountry
                    ? [selectedCountry.toLowerCase()]
                    : ["in", "sg"]
                }
                countryCodeEditable={false}
                inputStyle={{ width: "100%" }}
                dropdownStyle={{ zIndex: 100 }}
              />
            </div>

            {/* Full Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Full Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="John Doe"
                disabled={shouldDisableFollowingFields}
              />
            </div>

            {/* Organization Name */}
            <div className="grid gap-2">
              <Label htmlFor="organizationName">
                Organization Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="organizationName"
                value={profile.organizationName}
                onChange={(e) =>
                  handleChange("organizationName", e.target.value)
                }
                placeholder="My Organization"
                disabled={shouldDisableFollowingFields}
              />
            </div>

            {/* Primary Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Primary Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="organizer@example.com"
                disabled={shouldDisableFollowingFields}
              />
            </div>

            {/* Phone */}
            <div className="grid gap-2">
              <Label htmlFor="phone">
                Phone ({currentCountry?.dialCode})
              </Label>
              <PhoneInput
                key={`phone-${selectedCountry || "in"}`}
                country={selectedCountry?.toLowerCase() || "in"}
                value={profile.phone}
                onChange={(value) => handleChange("phone", value)}
                onlyCountries={
                  selectedCountry
                    ? [selectedCountry.toLowerCase()]
                    : ["in", "sg"]
                }
                countryCodeEditable={false}
                disabled={shouldDisableFollowingFields}
                inputStyle={{ width: "100%" }}
                dropdownStyle={{ zIndex: 100 }}
              />
            </div>

            {/* Address */}
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={profile.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Full organization address"
                disabled={shouldDisableFollowingFields}
              />
            </div>

            {/* Bio */}
            <div className="grid gap-2">
              <Label htmlFor="bio">About Organization</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="Tell us about your organization..."
                disabled={shouldDisableFollowingFields}
                rows={4}
              />
            </div>

            {/* Agent Referral Code (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="agentReferralCode">
                Referral Code{" "}
                <span className="text-xs text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="agentReferralCode"
                value={agentReferralCode}
                onChange={(e) => setAgentReferralCode(e.target.value)}
                placeholder="Enter referral code if you have one"
                disabled={shouldDisableFollowingFields}
              />
              {initialReferralCode && (
                <p className="text-xs text-green-600">
                  Referral code applied from invitation link.
                </p>
              )}
            </div>

            <p className="text-lg font-medium text-slate-700 mt-6">
              Your starter plan will be assigned automatically — no manual
              approval needed.
            </p>

            <CardFooter className="flex justify-end gap-3 p-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !profile.businessEmail ||
                  !emailVerified ||
                  !profile.whatsAppNumber ||
                  !profile.organizationName ||
                  !profile.name
                }
              >
                {isSubmitting ? "Registration in Progress..." : "Register"}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

