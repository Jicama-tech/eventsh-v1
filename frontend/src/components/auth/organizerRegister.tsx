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

const COUNTRIES = [
  {
    code: "IN",
    name: "India",
    countryCode: "+91",
  },
  {
    code: "SG",
    name: "Singapore",
    countryCode: "+65",
  },
];

export function OrganizerRegister() {
  const apiURL = __API_URL__;
  const navigate = useNavigate();
  const location = useLocation();
  const { name: initialName = "", email: initialEmail = "" } =
    location.state || {};
  const { toast } = useToast();

  // Capture agent referral code from ?ref=CODE in URL
  const initialReferralCode = (() => {
    try {
      return new URLSearchParams(location.search).get("ref") || "";
    } catch {
      return "";
    }
  })();
  const [agentReferralCode, setAgentReferralCode] =
    useState(initialReferralCode);

  // Country selection
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const currentCountry = selectedCountry
    ? COUNTRIES.find((c) => c.code === selectedCountry)
    : null;

  // Profile state
  const [profile, setProfile] = useState({
    name: initialName,
    organizationName: "",
    email: initialEmail,
    businessEmail: "",
    phone: "",
    whatsAppNumber: "",
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

  // WhatsApp OTP state
  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waOtp, setWaOtp] = useState("");
  const [waVerified, setWaVerified] = useState(false);
  const [waOtpError, setWaOtpError] = useState("");
  const [sendingWaOtp, setSendingWaOtp] = useState(false);
  const [verifyingWaOtp, setVerifyingWaOtp] = useState(false);

  // General loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    setProfile((prev) => ({
      ...prev,
      country: code,
      whatsAppNumber: "",
      phone: code === "SG" ? "+65" : "+91",
    }));
  };

  const handleChange = (field: string, value: any) => {
    if (field === "businessEmail") {
      setEmailVerified(false);
      setOtpSent(false);
      setOtp("");
      setOtpError("");
    }

    if (field === "whatsAppNumber") {
      setWaVerified(false);
      setWaOtpSent(false);
      setWaOtp("");
      setWaOtpError("");
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

  // WhatsApp OTP handlers
  const sendOtpToWhatsApp = async () => {
    if (!profile.whatsAppNumber || profile.whatsAppNumber.length < 8) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please enter a valid WhatsApp number with country code.",
      });
      return;
    }

    try {
      setSendingWaOtp(true);
      const token = sessionStorage.getItem("token");
      const response = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ whatsappNumber: profile.whatsAppNumber }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send WhatsApp OTP");
      }

      setWaOtpSent(true);
      setWaOtpError("");
      toast({
        duration: 5000,
        title: "OTP Sent",
        description: "OTP sent to WhatsApp",
      });
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Failed to send OTP",
        description: error.message || "Failed to send WhatsApp OTP",
        variant: "destructive",
      });
    } finally {
      setSendingWaOtp(false);
    }
  };

  const verifyOtpForWhatsApp = async () => {
    if (!waOtp || waOtp.length < 4) {
      setWaOtpError("Please enter a valid OTP");
      return;
    }

    try {
      setVerifyingWaOtp(true);
      const token = sessionStorage.getItem("token");
      const response = await fetch(`${apiURL}/otp/verify-whatsapp-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          whatsappNumber: profile.whatsAppNumber,
          otp: waOtp,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid WhatsApp OTP");
      }

      setWaVerified(true);
      setWaOtpError("");
      toast({
        duration: 5000,
        title: "Verified",
        description: "WhatsApp number verified",
      });
    } catch (error: any) {
      setWaOtpError(error.message);
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    } finally {
      setVerifyingWaOtp(false);
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

    if (!waVerified) {
      toast({
        duration: 5000,
        title: "Error",
        description: "Please verify your WhatsApp number",
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
          "Your account is active and the starter plan is assigned. Please log in via WhatsApp OTP.",
      });
      navigate("/login");
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
  const shouldDisableFollowingFields = !emailVerified && !waVerified;

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
                    {country.name} ({country.countryCode})
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

            {/* WhatsApp Number with OTP */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="whatsAppNumber"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  WhatsApp Number ({currentCountry?.countryCode}){" "}
                  <span className="text-red-600">*</span>
                  <p className="text-xs text-gray-500 font-normal ml-2 inline-block">
                    (Used for login)
                  </p>
                </Label>
                {waVerified && (
                  <Badge className="bg-green-600">
                    <CheckCircle className="w-4 h-4 mr-1" /> Verified
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <PhoneInput
                  country={selectedCountry?.toLowerCase() || "in"}
                  value={profile.whatsAppNumber}
                  onChange={(value) => handleChange("whatsAppNumber", value)}
                  disabled={waVerified || !emailVerified}
                  onlyCountries={
                    selectedCountry
                      ? [selectedCountry.toLowerCase()]
                      : ["in", "sg"]
                  }
                  countryCodeEditable={false}
                  inputStyle={{ width: "100%" }}
                  dropdownStyle={{ zIndex: 100 }}
                />
                <Button
                  type="button"
                  onClick={sendOtpToWhatsApp}
                  disabled={
                    sendingWaOtp || !profile.whatsAppNumber || waVerified
                  }
                >
                  {sendingWaOtp
                    ? "Sending..."
                    : waVerified
                      ? "Verified"
                      : "Send OTP"}
                </Button>
              </div>
              {waOtpSent && !waVerified && (
                <div className="flex gap-2 mt-2">
                  <Input
                    value={waOtp}
                    onChange={(e) => setWaOtp(e.target.value)}
                    placeholder="Enter WhatsApp OTP"
                  />
                  <Button
                    type="button"
                    onClick={verifyOtpForWhatsApp}
                    disabled={verifyingWaOtp}
                  >
                    {verifyingWaOtp ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              )}
              {waOtpError && (
                <p className="text-sm text-red-600">{waOtpError}</p>
              )}
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
                Phone ({currentCountry?.countryCode})
              </Label>
              <PhoneInput
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
                  !waVerified ||
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
