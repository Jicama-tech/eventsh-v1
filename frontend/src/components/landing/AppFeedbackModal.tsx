import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Star, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type Role = "organizer" | "vendor" | "visitor" | "speaker" | "general";

// Shared classNames so every input + select in the form matches the dark
// theme used by the landing-page testimonial cards.
const darkInputClass =
  "bg-[#0a0a0c] border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-primary/40 focus-visible:border-white/20";
const darkLabelClass = "text-xs text-slate-400";

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover || value) >= n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => !disabled && setHover(0)}
            className="transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              size={32}
              className={
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-slate-700"
              }
            />
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppFeedbackModal({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"email" | "form" | "done">("email");
  const [email, setEmail] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("general");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep("email");
    setEmail("");
    setOtp("");
    setName("");
    setRole("general");
    setCity("");
    setRating(0);
    setComment("");
  };

  const requestOtp = async () => {
    if (!email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch(`${apiURL}/app-feedback/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Could not send code");
      toast({
        title: "Code sent",
        description: `Check ${email.trim()} for the verification code.`,
      });
      setStep("form");
    } catch (err: any) {
      toast({
        title: "Could not send code",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setOtpSending(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !otp.trim() || !comment.trim() || rating < 1) {
      toast({
        title: "Missing fields",
        description: "Name, rating, comment and OTP are all required.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiURL}/app-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role,
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          rating,
          comment: comment.trim(),
          city: city.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Submission failed");
      setStep("done");
    } catch (err: any) {
      toast({
        title: "Submission failed",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 200); // wait for close animation
      }}
    >
      <DialogContent className="max-w-md bg-[#121216] border-white/5 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            Share your thoughts on Eventsh
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            We read every response. We'll send a one-time code to your email to
            verify it's really you.
          </DialogDescription>
        </DialogHeader>

        {step === "email" && (
          <div className="space-y-4">
            <div>
              <Label className={darkLabelClass}>Email</Label>
              <Input
                type="email"
                placeholder="your-email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={darkInputClass}
              />
            </div>
            <Button
              onClick={requestOtp}
              disabled={otpSending || !email.trim()}
              className="w-full"
            >
              {otpSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending
                  code…
                </>
              ) : (
                "Send verification code"
              )}
            </Button>
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label className={darkLabelClass}>
                Verification code (sent to {email})
              </Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className={`${darkInputClass} text-center text-lg tracking-widest`}
                placeholder="6-digit code"
              />
            </div>
            <div>
              <Label className={darkLabelClass}>Your name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Mehta"
                className={darkInputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className={darkLabelClass}>I'm a…</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className={darkInputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0c] border-white/10 text-white">
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="visitor">Visitor</SelectItem>
                    <SelectItem value="speaker">Speaker</SelectItem>
                    <SelectItem value="general">Just exploring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={darkLabelClass}>City (optional)</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai"
                  className={darkInputClass}
                />
              </div>
            </div>
            <div>
              <Label className={darkLabelClass}>Rating</Label>
              <div className="mt-1">
                <StarRating value={rating} onChange={setRating} />
              </div>
            </div>
            <div>
              <Label className={darkLabelClass}>What did you think?</Label>
              <Textarea
                rows={4}
                maxLength={500}
                placeholder="What worked for you, what could be better?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className={darkInputClass}
              />
              <p className="text-[11px] text-slate-500 mt-1 text-right">
                {comment.length}/500
              </p>
            </div>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                !name.trim() ||
                !otp.trim() ||
                !comment.trim() ||
                rating < 1
              }
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit feedback"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:text-white hover:bg-white/5"
              onClick={() => setStep("email")}
              disabled={submitting}
            >
              Use a different email
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
            <p className="font-semibold text-lg text-white">Thanks!</p>
            <p className="text-sm text-slate-400">
              Your feedback is with the team. We feature highlights on the
              landing page, so you may see your words there soon.
            </p>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
