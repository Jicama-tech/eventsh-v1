import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const apiURL = __API_URL__;

export type PaymentFeedbackType =
  | "vendor"
  | "stall_edit"
  | "visitor"
  | "speaker"
  | "round_table";

interface PaymentFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizerId?: string;
  paymentType: PaymentFeedbackType;
  eventId?: string;
  eventTitle?: string;
  payerName?: string;
  payerEmail?: string;
  bookingId?: string;
  amount?: number;
  /** Called after the dialog closes (submitted or skipped). */
  onDone?: () => void;
}

/**
 * A single, reusable "How was your experience?" dialog shown right after any
 * payment is submitted (vendor / stall-edit / visitor / speaker / round-table).
 * Captures a 1–5 star rating + an optional comment and posts it to
 * `/payment-feedback`, where it surfaces to both the organizer and the Eventsh
 * admin. Rating is required to submit; the payer can also skip.
 */
export default function PaymentFeedbackDialog({
  open,
  onOpenChange,
  organizerId,
  paymentType,
  eventId,
  eventTitle,
  payerName,
  payerEmail,
  bookingId,
  amount,
  onDone,
}: PaymentFeedbackDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setRating(0);
    setHover(0);
    setComment("");
    onOpenChange(false);
    onDone?.();
  };

  const submit = async () => {
    if (rating < 1) {
      toast({
        variant: "destructive",
        title: "Please tap a star",
        description: "Pick a rating from 1 to 5 first.",
      });
      return;
    }
    if (!organizerId) {
      // No organizer context — nothing to attach the feedback to; just close.
      close();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiURL}/payment-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizerId,
          paymentType,
          eventId,
          eventTitle,
          rating,
          comment,
          payerName,
          payerEmail,
          bookingId,
          amount,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || "Couldn't submit feedback.");
      }
      toast({
        title: "Thanks for your feedback! 🙏",
        description: "Your rating helps the organizer and EventSH improve.",
      });
      close();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Couldn't submit",
        description: e?.message || "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
        else onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your experience?</DialogTitle>
          <DialogDescription>
            Your payment was submitted. Rate your experience
            {eventTitle ? ` with ${eventTitle}` : ""} — it's shared with the
            organizer and EventSH.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-3">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                className="transition-transform hover:scale-110"
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                <Star
                  className={`h-9 w-9 ${
                    (hover || rating) >= n
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="h-5 text-sm font-medium text-gray-600">
            {labels[hover || rating] || "Tap to rate"}
          </p>
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more about your experience (optional)…"
          rows={4}
        />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={close} disabled={submitting}>
            Skip
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit feedback"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
