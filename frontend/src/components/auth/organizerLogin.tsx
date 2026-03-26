import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Shield, Mail, Building, Loader2 } from "lucide-react";
import { useCountryCodes } from "@/hooks/useCountryCodes";
import { useCountry } from "@/hooks/useCountry";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jwtDecode } from "jwt-decode";
import { organizerToken } from "@/pages/organizer/EventfrontTemplate";

type LoginStep = "number" | "otp" | "selection";

interface OrganizerProfile {
  id: string;
  organizationName: string;
  approved?: boolean;
}

export function OrganizerLogin() {
  const { setCountry: setGlobalCountry } = useCountry();
  const [whatsappNumber, setWhatsAppNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+65");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [step, setStep] = useState<LoginStep>("number");
  const [organizers, setOrganizers] = useState<OrganizerProfile[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const { countryCodes, loading: loadingCountryCodes } = useCountryCodes();

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const apiURL = __API_URL__;

  // --- OTP Input Handlers ---
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length && i < 6; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    const nextIndex = pasted.length < 6 ? pasted.length : 5;
    inputRefs.current[nextIndex]?.focus();
  };

  const fullNumber = countryCode + whatsappNumber;

  // --- Step 1: Send OTP ---
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappNumber || whatsappNumber.length < 6) {
      toast({
        duration: 5000,
        title: "Invalid Number",
        description: "Please enter a valid WhatsApp number",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          role: "organizer",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send OTP");
      }

      toast({
        duration: 5000,
        title: "OTP Sent",
        description: `Code sent to ${fullNumber}`,
      });
      setStep("otp");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message || "Failed to send OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 2: Verify OTP (Initial Check) ---
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast({
        duration: 5000,
        title: "Invalid OTP",
        description: "Please enter all 6 digits",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          otp: otpString,
          role: "organizer",
        }),
      });

      const result = await response.json();

      if (!response.ok)
        throw new Error(result.message || "Verification failed");

      // FIX: Match the backend key 'organizations' or 'organizers'
      // Based on your previous backend snippet, it was 'organizations'
      if (result.requiresSelection) {
        const list = result.organizations || result.organizers || [];
        setOrganizers(list);
        setStep("selection"); // This triggers the UI change
        toast({
          duration: 5000,
          title: "Multiple Accounts Found",
          description: "Please select an organization to proceed.",
        });
        return;
      }

      // If only one was found, the backend returns 'data' (the token)
      if (result.data) {
        await performLogin(result.data, result.name);
      }
    } catch (error: any) {
      toast({
        duration: 5000,
        variant: "destructive",
        title: "Error",
        description: error.message || "Invalid OTP",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 3: Confirm Organization Selection ---
  const handleOrgSelection = async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);

    try {
      const otpString = otp.join(""); // Resend OTP for final validation

      const response = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          otp: otpString,
          role: "organizer",
          shopId: selectedOrgId, // Include the selected ID
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Selection failed");

      if (result.data) {
        await performLogin(result.data, result.organizer?.name);
      }
    } catch (error: any) {
      toast({
        duration: 5000,
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
      // If OTP expired during selection, send them back to number input
      if (error.message.includes("expired")) {
        setStep("number");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to handle token storage and navigation
  const performLogin = async (token: string, organizerName?: string) => {
    try {
      // Save to SessionStorage as per original Organizer logic
      sessionStorage.setItem("token", token);

      const decoded = jwtDecode<organizerToken>(token);
      const country = decoded.country;

      setGlobalCountry(country || "IN");

      if (login) {
        await login(token);
      }

      toast({
        duration: 5000,
        title: "Login Successful",
        description: `Welcome back${organizerName ? `, ${organizerName}` : ""}! Redirecting...`,
      });

      navigate("/organizer-dashboard", { replace: true });
    } catch (e) {
      console.error("Login context error", e);
      window.location.href = "/organizer-dashboard";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-xl border-slate-100">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            {step === "number" && <Shield className="h-8 w-8 text-slate-600" />}
            {step === "otp" && <Mail className="h-8 w-8 text-slate-600" />}
            {step === "selection" && (
              <Building className="h-8 w-8 text-slate-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            {step === "number"
              ? "Organizer Login"
              : step === "otp"
                ? "Verify Code"
                : "Select Organization"}
          </CardTitle>
          <CardDescription>
            {step === "number" &&
              "Enter your WhatsApp number to receive a code"}
            {step === "otp" && `Enter the 6-digit code sent to ${fullNumber}`}
            {step === "selection" &&
              "Multiple organizations found linked to this number"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "number" && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="flex gap-2">
                <select
                  className="w-36 border rounded p-2"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={isLoading || loadingCountryCodes}
                  required
                >
                  <option value="">Select Country</option>
                  {countryCodes.map((cc) => (
                    <option key={cc.dial_code + cc.name} value={cc.dial_code}>
                      {cc.name} ({cc.dial_code})
                    </option>
                  ))}
                </select>
                <Input
                  type="tel"
                  placeholder="WhatsApp number"
                  value={whatsappNumber}
                  onChange={(e) =>
                    setWhatsAppNumber(e.target.value.replace(/\D/g, ""))
                  }
                  className="flex-1"
                  maxLength={15}
                  disabled={isLoading}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading || whatsappNumber.length < 6}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-between gap-1">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    value={digit}
                    ref={(el) => (inputRefs.current[index] = el)}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-12 h-12 text-center text-xl font-bold"
                    maxLength={1}
                    inputMode="numeric"
                    disabled={isLoading}
                  />
                ))}
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={isLoading || otp.join("").length !== 6}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Code
              </Button>
              <Button
                variant="link"
                type="button"
                className="w-full text-slate-500"
                onClick={() => {
                  setStep("number");
                  setOtp(["", "", "", "", "", ""]);
                }}
                disabled={isLoading}
              >
                Change Number
              </Button>
            </form>
          )}

          {step === "selection" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Organization to Manage</Label>
                <Select onValueChange={setSelectedOrgId} value={selectedOrgId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Choose an organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizers.map((org) => (
                      <SelectItem
                        key={org.id}
                        value={org.id}
                        disabled={org.approved === false} // Prevents selection if unapproved
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span
                            className={
                              org.approved === false
                                ? "text-muted-foreground"
                                : ""
                            }
                          >
                            {org.organizationName}
                          </span>
                          {org.approved === false && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                              Pending Approval
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleOrgSelection}
                className="w-full h-11"
                disabled={isLoading || !selectedOrgId}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enter Dashboard
              </Button>
              <Button
                variant="ghost"
                className="w-full h-11"
                onClick={() => setStep("otp")}
                disabled={isLoading}
              >
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
