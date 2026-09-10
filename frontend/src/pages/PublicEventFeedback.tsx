import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Loader2, Star } from "lucide-react";

const apiURL = __API_URL__;

interface EventMeta {
  eventId: string;
  title: string;
  startDate?: string | null;
  location?: string;
}

/**
 * Open feedback form behind the link an organizer shares from My Events.
 *
 * Deliberately standalone and unauthenticated: no ticket, no token, no
 * account. Anyone handed the link can leave a name, a rating and a message.
 * That also means nothing here is treated as identity — the name is a label
 * on the response, and the organizer sees these under their own "Public"
 * audience rather than mixed in with ticket-verified visitor feedback.
 *
 * Pinned to the light theme for the same reason the scanner is: the page uses
 * literal palette colours that do not follow the dark theme.
 */
export default function PublicEventFeedback() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();

  const [meta, setMeta] = useState<EventMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!eventId) {
        setLoadError("This feedback link is missing an event.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${apiURL}/events/${eventId}/feedback/public/meta`,
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof body?.message === "string"
              ? body.message
              : "This feedback link is no longer valid.",
          );
        }
        if (!cancelled) setMeta(body.data);
      } catch (e: unknown) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? e.message
              : "This feedback link is no longer valid.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your full name.",
        variant: "destructive",
      });
      return;
    }
    if (rating < 1) {
      toast({
        title: "Rating required",
        description: "Please pick a star rating.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${apiURL}/events/${eventId}/feedback/public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          rating,
          comment: comment.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const m = body?.message;
        throw new Error(
          Array.isArray(m)
            ? m.join(", ")
            : typeof m === "string"
              ? m
              : "Could not submit your feedback.",
        );
      }
      setDone(true);
    } catch (e: unknown) {
      toast({
        title: "Could not submit",
        description:
          e instanceof Error ? e.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="theme-light-only min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );

  if (loading) {
    return shell(
      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>,
    );
  }

  if (loadError) {
    return shell(
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">Feedback unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            {loadError}
          </p>
        </CardContent>
      </Card>,
    );
  }

  if (done) {
    return shell(
      <Card>
        <CardHeader className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-3" />
          <CardTitle className="text-green-800">Thank you!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            Your feedback for <strong>{meta?.title}</strong> has been sent to
            the organizer.
          </p>
        </CardContent>
      </Card>,
    );
  }

  return shell(
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Share your feedback</CardTitle>
        {meta?.title && (
          <p className="text-sm text-muted-foreground mt-1">{meta.title}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pf-name">Full name</Label>
          <Input
            id="pf-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={120}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label>Rating</Label>
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hoverRating || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  disabled={submitting}
                  className="p-1 disabled:opacity-60"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      active
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              );
            })}
            {rating > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
                {rating} / 5
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pf-message">Message</Label>
          <Textarea
            id="pf-message"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went well? What could be better?"
            rows={5}
            maxLength={2000}
            disabled={submitting}
          />
          <p className="text-[11px] text-muted-foreground text-right">
            {comment.length}/2000
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 text-base"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit feedback"
          )}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          Your feedback goes directly to the event organizer.
        </p>
      </CardContent>
    </Card>,
  );
}
