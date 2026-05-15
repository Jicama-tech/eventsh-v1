import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Star, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

type Audience = "visitor" | "exhibitor" | "speaker" | "round_table";

interface Props {
  eventId: string;
  eventEndDate?: string | Date;
  hasTickets?: boolean;
}

interface EligibilityResponse {
  audience: Audience;
  eventId: string;
  eventTitle: string;
  subjectId: string;
  display: Record<string, any>;
  alreadySubmitted: boolean;
  existing?: { rating: number; comment: string } | null;
}

// 1-5 star picker. Click sets, hover previews.
function StarRating({
  value,
  onChange,
  size = 28,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
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
              size={size}
              className={filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
            />
          </button>
        );
      })}
    </div>
  );
}

// Visitor flow: enter email + rate the event after the event has ended.
// Email must match a sold ticket. Backend enforces this.
export function VisitorFeedbackCard({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Enter the email you used to buy the ticket.",
        variant: "destructive",
      });
      return;
    }
    if (rating < 1) {
      toast({
        title: "Rating required",
        description: "Pick at least 1 star.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/events/${eventId}/feedback/visitor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            rating,
            comment: comment.trim(),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.message ||
            "We couldn't accept your feedback. Please try a different email.",
        );
      }
      setSubmitted(true);
      toast({
        title: "Thanks for the feedback!",
        description: "Your rating has been recorded.",
      });
    } catch (err: any) {
      toast({
        title: "Could not submit",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="py-8 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="font-medium">Thanks for your feedback!</p>
          <p className="text-sm text-muted-foreground">
            We've recorded your rating for the organizer.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> How was the event?
        </CardTitle>
        <CardDescription>
          Visitors who bought a ticket can rate this event. Use the email on
          your ticket.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Email on your ticket</Label>
          <Input
            type="email"
            placeholder="your-email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div>
          <Label className="text-xs">Rating</Label>
          <div className="mt-1">
            <StarRating
              value={rating}
              onChange={setRating}
              disabled={submitting}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Comment (optional)</Label>
          <Textarea
            rows={3}
            placeholder="What did you enjoy? What could be better?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting}
          />
        </div>
        <Button
          onClick={submit}
          disabled={submitting || rating < 1 || !email.trim()}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// Token-driven flow: vendor / speaker / round-table guest follows the
// WhatsApp deep link after checkout. We resolve the token → display their
// booking details + collect feedback.
function TokenFeedbackDialog({
  token,
  audience,
  eventId,
  onClose,
}: {
  token: string;
  audience: Audience;
  eventId: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(
    null,
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiURL}/feedback/eligibility?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message || "This feedback link is invalid.");
        }
        if (cancelled) return;
        setEligibility(data);
        if (data.alreadySubmitted && data.existing) {
          setRating(data.existing.rating);
          setComment(data.existing.comment || "");
          setSubmitted(true);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Invalid link");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (rating < 1) {
      toast({ title: "Pick a rating", variant: "destructive" });
      return;
    }
    const path =
      audience === "exhibitor"
        ? "exhibitor"
        : audience === "speaker"
          ? "speaker"
          : "round-table";
    setSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/events/${eventId}/feedback/${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, rating, comment: comment.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Submission failed");
      }
      setSubmitted(true);
      toast({
        title: "Feedback recorded",
        description:
          audience === "exhibitor"
            ? "Thank you. The organizer can now process your deposit refund."
            : "Thanks for sharing your experience.",
      });
    } catch (err: any) {
      toast({
        title: "Could not submit",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = useMemo(() => {
    if (!eligibility?.display) return "";
    const d = eligibility.display;
    if (audience === "exhibitor") return d.stallName || "Your stall";
    if (audience === "speaker") return d.speakerName || "Your session";
    return d.tableName || "Your table";
  }, [eligibility, audience]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {audience === "exhibitor"
              ? "Exhibitor Feedback"
              : audience === "speaker"
                ? "Speaker Feedback"
                : "Round-Table Feedback"}
          </DialogTitle>
          <DialogDescription>
            {eligibility?.eventTitle && `${eligibility.eventTitle} · `}
            {displayName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        ) : submitted ? (
          <div className="space-y-3 text-center py-4">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="font-medium">Feedback submitted</p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={() => {}} disabled />
            </div>
            {comment && (
              <p className="text-sm text-muted-foreground italic max-w-sm mx-auto">
                "{comment}"
              </p>
            )}
            {audience === "exhibitor" && (
              <p className="text-xs text-muted-foreground">
                The organizer has been notified to release your deposit refund.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Rating</Label>
              <div className="mt-1">
                <StarRating value={rating} onChange={setRating} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Comment (optional)</Label>
              <Textarea
                rows={4}
                placeholder="Share your experience"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <Button
              onClick={submit}
              disabled={submitting || rating < 1}
              className="w-full"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit Feedback"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Token-driven dialog handler — independent of any tab. Renders nothing
// unless the URL has ?feedback=<audience>&token=...; in that case it pops
// the exhibitor/speaker/round-table feedback dialog regardless of which
// EventFront tab the user is on.
export function EventFeedbackTokenHandler({
  eventId,
}: {
  eventId: string;
}) {
  const [params, setParams] = useSearchParams();
  const audienceParam = params.get("feedback") as Audience | null;
  const token = params.get("token");

  const clearTokenParams = () => {
    const next = new URLSearchParams(params);
    next.delete("feedback");
    next.delete("token");
    setParams(next, { replace: true });
  };

  const tokenDialogActive =
    !!audienceParam &&
    !!token &&
    ["exhibitor", "speaker", "round_table"].includes(audienceParam);

  if (!tokenDialogActive) return null;
  return (
    <TokenFeedbackDialog
      token={token!}
      audience={audienceParam!}
      eventId={eventId}
      onClose={clearTokenParams}
    />
  );
}

// Legacy combined entry point — kept for any caller that wants both pieces
// in one mount. New callers should use EventFeedbackTokenHandler +
// VisitorFeedbackCard separately so the card can live inside a tab.
export function EventFeedback({ eventId, eventEndDate, hasTickets }: Props) {
  const eventEnded = useMemo(() => {
    if (!eventEndDate) return true;
    return new Date(eventEndDate) <= new Date();
  }, [eventEndDate]);

  return (
    <>
      <EventFeedbackTokenHandler eventId={eventId} />
      {eventEnded && hasTickets && (
        <div className="my-8 max-w-2xl mx-auto px-4">
          <VisitorFeedbackCard eventId={eventId} />
        </div>
      )}
    </>
  );
}
