import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PhoneField } from "@/components/ui/PhoneField";
import {
  Heart,
  Check,
  Loader2,
  Plus,
  X,
  Mail,
  MapPin,
  PartyPopper,
} from "lucide-react";

interface MarriageFunctionOption {
  id: string;
  name: string;
  date?: string;
  time?: string;
  venueName?: string;
  address?: string;
}

// Google Maps search link for a function's venue, or "" when it has none.
function functionMapsHref(fn: MarriageFunctionOption): string {
  const q = [fn.venueName, fn.address].filter(Boolean).join(" ").trim();
  return q
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
    : "";
}

interface MarriageRsvpProps {
  eventId: string;
  // The wedding's ceremonies, so the guest can pick which ones they'll attend.
  // Passed down from MarriageEventFront (driven by the event's functions[]).
  functions?: MarriageFunctionOption[];
}

interface GuestProfile {
  email: string;
  name: string;
}

const apiURL = __API_URL__;
const LS_KEY = "eventsh:google-member";

// One attending guest. Age is kept as a string for the controlled input;
// it's converted to a number on submit. The backend derives the age-group
// summary (adults/seniors/children/infants) from these ages.
interface Attendee {
  name: string;
  age: string;
  contactNumber: string;
}
const EMPTY_ATTENDEE: Attendee = { name: "", age: "", contactNumber: "" };

/**
 * Guest RSVP for a wedding eventfront. The guest signs in with Google
 * (reusing the existing member OAuth popup → postMessage flow), then fills
 * Name / Contact / Number of guests / Message. Submitting upserts an RSVP
 * keyed on (event, verified email), so returning guests edit their response.
 */
export default function MarriageRsvp({
  eventId,
  functions = [],
}: MarriageRsvpProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [name, setName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  // Full roster of attending guests (name + age + contact).
  const [attendees, setAttendees] = useState<Attendee[]>([{ ...EMPTY_ATTENDEE }]);
  const namedAttendees = attendees.filter((a) => a.name.trim());
  const totalGuests = namedAttendees.length;
  const setAtt = (i: number, key: keyof Attendee, val: string) =>
    setAttendees((a) =>
      a.map((x, idx) => (idx === i ? { ...x, [key]: val } : x)),
    );
  const addAtt = () =>
    setAttendees((a) => [...a, { ...EMPTY_ATTENDEE }]);
  const removeAtt = (i: number) =>
    setAttendees((a) => (a.length > 1 ? a.filter((_, idx) => idx !== i) : a));
  const [message, setMessage] = useState("");
  const [attending, setAttending] = useState(true);
  // Which family the guest belongs to ("groom" | "bride" | "").
  const [side, setSide] = useState("");
  // Ids of the ceremonies the guest will attend.
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const hasFunctions = functions.length > 0;

  const toggleFunction = (id: string) =>
    setSelectedFunctions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const popupRef = useRef<Window | null>(null);

  // Once we have a verified guest, prefill the form (name from Google) and
  // load any RSVP they already submitted so they can edit it.
  const onProfile = async (p: GuestProfile) => {
    setProfile(p);
    setName((prev) => prev || p.name || "");
    // Seed the first attendee row with the signed-in guest's name.
    setAttendees((prev) =>
      prev.length === 1 && !prev[0].name.trim()
        ? [{ ...prev[0], name: p.name || "" }]
        : prev,
    );
    setAuthLoading(false);
    try {
      const res = await fetch(
        `${apiURL}/events/${eventId}/rsvp/mine?email=${encodeURIComponent(
          p.email,
        )}`,
      );
      const json = await res.json();
      const mine = json?.data;
      if (mine) {
        setName(mine.name || p.name || "");
        setContactNumber(mine.contactNumber || "");
        if (Array.isArray(mine.attendees) && mine.attendees.length > 0) {
          setAttendees(
            mine.attendees.map((a: any) => ({
              name: a?.name || "",
              age: a?.age != null && a.age !== "" ? String(a.age) : "",
              contactNumber: a?.contactNumber || "",
            })),
          );
        } else {
          // Older RSVP without a roster — seed a single row from what we have.
          setAttendees([
            {
              name: mine.name || p.name || "",
              age: "",
              contactNumber: mine.contactNumber || "",
            },
          ]);
        }
        setMessage(mine.message || "");
        setAttending(mine.attending !== false);
        setSide(mine.side || "");
        setSelectedFunctions(
          Array.isArray(mine.functions)
            ? mine.functions.map((f: any) => f?.id).filter(Boolean)
            : [],
        );
        setSubmitted(true);
      }
    } catch {
      /* prefill is best-effort */
    }
  };

  // Google sign-in popup → backend completes OAuth → posts {kind,email,name}.
  const handleGoogleLogin = () => {
    const url = `${apiURL}/auth/google-member`;
    const w = 480;
    const h = 600;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      url,
      "eventsh-google-member",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      toast({
        title: "Popup blocked",
        description: "Allow pop-ups for this site and try again.",
        variant: "destructive",
      });
      return;
    }
    popupRef.current = popup;
    setAuthLoading(true);
  };

  // postMessage listener + localStorage fallback (some browsers sever
  // window.opener on cross-origin nav, so the callback also writes LS).
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data: any = ev?.data;
      if (!data || data.kind !== "eventsh:google-member") return;
      const email = String(data.email || "").toLowerCase();
      if (!email) {
        setAuthLoading(false);
        toast({
          title: "Sign-in failed",
          description: "Couldn't read your Google email.",
          variant: "destructive",
        });
        return;
      }
      onProfile({ email, name: data.name || "" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!authLoading) return;
    const t = setInterval(() => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (
            data?.email &&
            data?.at &&
            Date.now() - data.at < 2 * 60 * 1000
          ) {
            localStorage.removeItem(LS_KEY);
            onProfile({
              email: String(data.email).toLowerCase(),
              name: data.name || "",
            });
          }
        }
      } catch {
        /* ignore */
      }
      // If the user closed the popup without finishing, stop spinning.
      if (popupRef.current && popupRef.current.closed) {
        setAuthLoading(false);
      }
    }, 800);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const handleSubmit = async () => {
    if (!profile) return;
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    try {
      setSubmitting(true);
      const res = await fetch(`${apiURL}/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: profile.email,
          contactNumber: contactNumber.trim(),
          guestCount: attending ? Math.max(1, totalGuests) : 0,
          attendees: attending
            ? namedAttendees.map((a) => ({
                name: a.name.trim(),
                age: a.age !== "" ? Number(a.age) : undefined,
                contactNumber: a.contactNumber.trim(),
              }))
            : [],
          message: message.trim(),
          attending,
          side,
          // Snapshot the selected ceremonies as {id, name} so the couple's
          // guest list stays readable. Only meaningful when attending.
          functions: attending
            ? functions
                .filter((f) => selectedFunctions.includes(f.id))
                .map((f) => ({ id: f.id, name: f.name }))
            : [],
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to submit RSVP");
      }
      setSubmitted(true);
      toast({
        title: attending ? "RSVP confirmed 💛" : "Response saved",
        description: attending
          ? "Thank you — we can't wait to celebrate with you!"
          : "We'll miss you, thank you for letting us know.",
      });
    } catch (e: any) {
      toast({
        title: "Couldn't submit",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ---- States ------------------------------------------------------------

  // Not signed in yet.
  if (!profile) {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-sm">
        <p className="mb-6 text-stone-600">
          Kindly let us know if you’ll be joining us.
        </p>
        <button
          onClick={handleGoogleLogin}
          disabled={authLoading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-stone-200 bg-white px-6 py-3 text-base font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:opacity-60"
        >
          {authLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Waiting for Google…
            </>
          ) : (
            <>
              <GoogleGlyph /> Sign in with Google to RSVP
            </>
          )}
        </button>
        <p className="mt-4 text-xs text-stone-400">
          We use your Google account only to confirm your RSVP.
        </p>
      </div>
    );
  }

  // Signed in — RSVP form.
  return (
    <div className="mx-auto mt-8 max-w-md rounded-3xl border border-rose-100 bg-white p-7 text-left shadow-sm">
      {submitted && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <PartyPopper className="h-4 w-4" />
          {attending
            ? "You're on the guest list! You can update your details below."
            : "Your response is saved. You can change it below."}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 text-sm text-stone-500">
        <Mail className="h-4 w-4 text-rose-400" />
        {profile.email}
      </div>

      {/* Attending toggle */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-stone-100 p-1">
        <button
          type="button"
          onClick={() => setAttending(true)}
          className={`rounded-full py-2 text-sm font-medium transition ${
            attending
              ? "bg-rose-600 text-white shadow"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Joyfully accept
        </button>
        <button
          type="button"
          onClick={() => setAttending(false)}
          className={`rounded-full py-2 text-sm font-medium transition ${
            !attending
              ? "bg-stone-700 text-white shadow"
              : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Regretfully decline
        </button>
      </div>

      {/* Which side is the guest from — Groom's or Bride's. Tapping the
          active option again clears it (it's optional). */}
      <Field label="Which side are you from?">
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "groom", label: "Groom's side" },
            { key: "bride", label: "Bride's side" },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSide((s) => (s === opt.key ? "" : opt.key))}
              className={`rounded-full border py-2 text-sm font-medium transition ${
                side === opt.key
                  ? "border-rose-500 bg-rose-600 text-white shadow"
                  : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Your name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="rsvp-input"
        />
      </Field>

      <Field label="Contact number">
        <PhoneField
          value={contactNumber}
          onChange={setContactNumber}
          placeholder="Phone number"
        />
      </Field>

      {attending && (
        <Field label="Who's attending? (name · age · contact)">
          <div className="space-y-2">
            {attendees.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border border-stone-100 bg-stone-50/50 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={a.name}
                    onChange={(e) => setAtt(i, "name", e.target.value)}
                    placeholder={i === 0 ? "Your name" : `Guest ${i + 1} name`}
                    className="rsvp-input flex-1"
                  />
                  {attendees.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAtt(i)}
                      className="flex-shrink-0 -m-1 p-1 text-stone-400 hover:text-red-600"
                      title="Remove guest"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-20 flex-shrink-0">
                    <input
                      type="number"
                      min={0}
                      value={a.age}
                      onChange={(e) => setAtt(i, "age", e.target.value)}
                      placeholder="Age"
                      className="rsvp-input"
                    />
                  </div>
                  <div className="flex-1">
                    <PhoneField
                      value={a.contactNumber}
                      onChange={(v) => setAtt(i, "contactNumber", v)}
                      placeholder="Contact no."
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addAtt}
              className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              <Plus className="h-4 w-4" /> Add guest
            </button>
            <div className="flex items-center justify-between px-1 pt-1 text-sm font-semibold text-rose-700">
              <span>Total attending</span>
              <span>{totalGuests}</span>
            </div>
          </div>
        </Field>
      )}

      {/* Per-ceremony attendance — only shown when the guest is attending and
          the wedding actually has functions defined. */}
      {attending && hasFunctions && (
        <Field label="Which functions will you attend?">
          <div className="space-y-2">
            {functions.map((fn) => {
              const checked = selectedFunctions.includes(fn.id);
              const mapsHref = functionMapsHref(fn);
              const whenText = [fn.date, fn.time].filter(Boolean).join(" · ");
              return (
                <div
                  key={fn.id}
                  className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                    checked
                      ? "border-rose-300 bg-rose-50"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleFunction(fn.id)}
                      className="flex flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                          checked
                            ? "border-rose-500 bg-rose-500 text-white"
                            : "border-stone-300"
                        }`}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block font-medium ${
                            checked ? "text-rose-700" : "text-stone-700"
                          }`}
                        >
                          {fn.name}
                        </span>
                        {whenText && (
                          <span className="block text-xs text-stone-500">
                            {whenText}
                          </span>
                        )}
                        {fn.venueName && (
                          <span className="block text-xs text-stone-500">
                            {fn.venueName}
                          </span>
                        )}
                      </span>
                    </button>
                    {mapsHref && (
                      <a
                        href={mapsHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-shrink-0 items-center gap-1 rounded-full border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100"
                        title={`Open ${fn.venueName || "venue"} in Google Maps`}
                      >
                        <MapPin className="h-3 w-3" /> Map
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Field>
      )}

      <Field label="Message / wishes (optional)">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A note for the couple…"
          rows={3}
          className="rsvp-input resize-none"
        />
      </Field>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-6 py-3 text-base font-medium text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : submitted ? (
          <>
            <Check className="h-4 w-4" /> Update RSVP
          </>
        ) : (
          <>
            <Heart className="h-4 w-4 fill-current" /> Send RSVP
          </>
        )}
      </button>

      {/* Scoped input styling so the fields match the romantic theme. */}
      <style>{`
        .rsvp-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #f1d9d4;
          background: #fffaf8;
          padding: 0.6rem 0.85rem;
          font-size: 0.95rem;
          color: #44403c;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .rsvp-input:focus {
          border-color: #e11d48;
          box-shadow: 0 0 0 3px rgba(225,29,72,0.12);
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-xs uppercase tracking-widest text-stone-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
