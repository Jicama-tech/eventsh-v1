import { useState, useRef } from "react";
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
import { ArrowLeft, Shield, Briefcase, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COUNTRY_CODES = [
  { code: "+91", name: "India" },
  { code: "+65", name: "Singapore" },
];

type LoginStep = "number" | "otp";

export function AgentLogin() {
  const apiURL = __API_URL__;
  const [whatsappNumber, setWhatsAppNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState<LoginStep>("number");
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const fullNumber = countryCode + whatsappNumber;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappNumber || whatsappNumber.length < 6) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          role: "agent",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send OTP");
      }

      toast({ title: "OTP Sent", description: `Code sent to ${fullNumber}` });
      setStep("otp");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      const otpString = otp.join("");
      const response = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          otp: otpString,
          role: "agent",
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Verification failed");

      if (result.data) {
        sessionStorage.setItem("token", result.data);
        if (login) await login(result.data);

        toast({
          title: "Login Successful",
          description: "Redirecting to agent dashboard...",
        });
        navigate("/agent-dashboard", { replace: true });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Invalid OTP",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-xl border-slate-100">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            {step === "number" ? (
              <Briefcase className="h-8 w-8 text-indigo-600" />
            ) : (
              <Shield className="h-8 w-8 text-indigo-600" />
            )}
          </div>
          <CardTitle className="text-2xl">Agent Login</CardTitle>
          <CardDescription>
            {step === "number"
              ? "Enter your WhatsApp number to receive a login code"
              : "Enter the 6-digit code sent to your WhatsApp"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "number" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <div className="flex gap-2">
                  <div className="w-28">
                    <Select
                      value={countryCode}
                      onValueChange={setCountryCode}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="tel"
                    placeholder="Enter number"
                    value={whatsappNumber}
                    onChange={(e) =>
                      setWhatsAppNumber(e.target.value.replace(/\D/g, ""))
                    }
                    maxLength={15}
                    className="flex-1"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isLoading || !whatsappNumber}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Send OTP
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex justify-center gap-2">
                {otp.map((digit, i) => (
                  <Input
                    key={i}
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-12 h-14 text-center text-xl font-bold border-2 focus:border-indigo-500"
                  />
                ))}
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={isLoading || otp.some((d) => !d)}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Verify & Login
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("number");
                  setOtp(["", "", "", "", "", ""]);
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Change Number
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Button
              variant="link"
              className="text-sm text-muted-foreground"
              onClick={() => navigate("/")}
            >
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
