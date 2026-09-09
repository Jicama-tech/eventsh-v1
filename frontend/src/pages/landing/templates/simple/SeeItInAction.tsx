import { useState } from "react";

import { SeeItInActionSectionProps, ShowcaseEvent } from "../types";

type Kind = "professional" | "personal" | "conference";

const COPY: Record<Kind, { title: string; blurb: string; tone: "a" | "b" | "c" }> = {
  professional: {
    title: "A trade show",
    blurb: "Stalls on a map. People pick one and pay.",
    tone: "a",
  },
  personal: {
    title: "A wedding",
    blurb: "Guests reply, rooms and tables sort themselves.",
    tone: "b",
  },
  conference: {
    title: "A conference",
    blurb: "Passes sold, then scanned at the door.",
    tone: "c",
  },
};

function imageFor(image: string): string {
  if (image.startsWith("http")) return image;
  return `${__API_URL__}${image.startsWith("/") ? "" : "/"}${image}`;
}

/* ------------------------------------------------------------------
   Drawn previews — pure CSS, no data, no network.

   A box uses a curated showcase event's screenshot when there is one. If
   there isn't, or the image fails to load, it falls back to one of these
   and is tagged "Preview" rather than "Live demo", so the layout never
   collapses and the page never promises a demo that isn't there.
   ------------------------------------------------------------------ */

const SOLD = new Set(["A-01", "A-03", "A-05", "B-02", "B-04", "C-02", "C-05"]);
const STALLS = [
  "A-01", "A-02", "A-03", "A-04", "A-05", "A-06",
  "B-01", "B-02", "B-03", "B-04", "B-05", "B-06",
  "C-01", "C-02", "C-03", "C-04", "C-05", "C-06",
];

function Chrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <span className="sp-draw" aria-hidden="true">
      <span className="sp-drawbar">
        <i />
        <i />
        <i />
        <em>{url}</em>
      </span>
      {children}
    </span>
  );
}

function FloorPreview() {
  return (
    <Chrome url="events.yourbrand.com/expo-2027">
      <span className="sp-floor">
        <b>MAIN STAGE</b>
        {STALLS.map((id) => (
          <s key={id} className={SOLD.has(id) ? "on" : undefined}>
            {id}
          </s>
        ))}
      </span>
    </Chrome>
  );
}

function GuestPreview() {
  const guests: [string, string, string][] = [
    ["RS", "Rohit & family", "4 coming"],
    ["MP", "Meera Patel", "2 coming"],
    ["AK", "Anand Kumar", "6 coming"],
    ["DS", "Divya Shah", "1 coming"],
  ];
  return (
    <Chrome url="events.yourname.com/wedding">
      <span className="sp-guests">
        {guests.map(([initials, name, count]) => (
          <span className="sp-g" key={name}>
            <u>{initials}</u>
            <p>{name}</p>
            <em>{count}</em>
          </span>
        ))}
      </span>
    </Chrome>
  );
}

// A deterministic block pattern that reads as a QR code without pretending
// to be a scannable one.
const QR = (() => {
  let s = 4242;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: 100 }, () => rnd() > 0.48);
})();

function CheckinPreview() {
  const scans: [string, string][] = [
    ["A. Okonkwo", "Delegate"],
    ["M. Silva", "Speaker"],
    ["R. Haddad", "Visitor"],
  ];
  return (
    <Chrome url="events.yourbrand.com/summit/check-in">
      <span className="sp-checkin">
        <span className="sp-qr">
          {QR.map((on, i) => (
            <i key={i} className={on ? "on" : undefined} />
          ))}
        </span>
        <span className="sp-scans">
          {scans.map(([name, role]) => (
            <span className="sp-scan" key={name}>
              <u>✓</u>
              <p>{name}</p>
              <em>{role}</em>
            </span>
          ))}
        </span>
      </span>
    </Chrome>
  );
}

const PREVIEW: Record<Kind, () => JSX.Element> = {
  professional: FloorPreview,
  personal: GuestPreview,
  conference: CheckinPreview,
};

/**
 * Three event boxes in a row, then a flat "start your own" bar beneath them.
 *
 * Each box prefers a real curated showcase event (admin sets isShowcase;
 * LandingPage does the fetch) and falls back to a drawn preview otherwise.
 * The start bar is deliberately shorter than the boxes above it: it is the
 * destination, not a fourth option to compare.
 */
export function SeeItInAction({
  showcaseEvents,
  onOpenDemo,
  onOpenDemoDashboard,
}: SeeItInActionSectionProps) {
  const personal = showcaseEvents.find((e) => e.showcaseKind === "personal");
  const pros = showcaseEvents.filter((e) => e.showcaseKind !== "personal");

  const slots: { kind: Kind; event?: ShowcaseEvent }[] = [
    { kind: "professional", event: pros[0] },
    { kind: "personal", event: personal },
    { kind: "conference", event: pros[1] },
  ];

  // Anything curated beyond the three featured boxes becomes the "more
  // examples" strip. An admin adds a use case simply by flagging another
  // event as a showcase — no code change, no new endpoint.
  const featured = new Set(slots.map((s) => s.event?._id).filter(Boolean));
  const more = showcaseEvents.filter((e) => !featured.has(e._id));

  return (
    <section className="wrap sp-section" id="demos">
      <div className="sp-boxes">
        {slots.map(({ kind, event }) => (
          <EventBox
            key={kind}
            kind={kind}
            event={event}
            onOpenDemo={onOpenDemo}
            onOpenDemoDashboard={onOpenDemoDashboard}
          />
        ))}
      </div>
      <StartBar />
      <MoreExamples events={more} onOpenDemo={onOpenDemo} />
    </section>
  );
}

/**
 * A compact strip of every other curated demo, one tile per use case.
 * Renders nothing when nothing else is curated — a heading promising more
 * examples over an empty row costs more trust than no strip at all.
 */
function MoreExamples({
  events,
  onOpenDemo,
}: {
  events: ShowcaseEvent[];
  onOpenDemo: (id: string) => void;
}) {
  if (events.length === 0) return null;
  return (
    <div className="sp-more">
      <p className="sp-more-h">More live examples</p>
      <div className="sp-more-grid">
        {events.map((ev) => (
          <button
            type="button"
            className="sp-chip"
            key={ev._id}
            onClick={() => onOpenDemo(ev._id)}
          >
            <i
              className={ev.showcaseKind === "personal" ? "b" : "a"}
              aria-hidden="true"
            />
            <span>{ev.title || "Live event"}</span>
            <em aria-hidden="true">→</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function startFree() {
  window.location.assign("/organizer/login");
}

function EventBox({
  kind,
  event,
  onOpenDemo,
  onOpenDemoDashboard,
}: {
  kind: Kind;
  event?: ShowcaseEvent;
  onOpenDemo: (id: string) => void;
  onOpenDemoDashboard: (id: string) => void;
}) {
  // A curated event whose screenshot 404s falls back to the drawn preview
  // rather than showing a broken-image icon.
  const [imageBroken, setImageBroken] = useState(false);

  const copy = COPY[kind];
  const Preview = PREVIEW[kind];
  const hasImage = Boolean(event?.image) && !imageBroken;
  const isLive = Boolean(event);
  const hasDashboard =
    event?.showcaseMode === "dashboard" || event?.showcaseMode === "both";

  const open = () => {
    if (event) onOpenDemo(event._id);
    else startFree();
  };

  return (
    <div className="sp-box">
      <button
        type="button"
        className="sp-screen"
        onClick={open}
        aria-label={
          isLive
            ? `Open the live demo for ${event?.title || copy.title}`
            : `Start an event like ${copy.title}`
        }
      >
        {hasImage ? (
          <img
            src={imageFor(event!.image!)}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <Preview />
        )}
        <span className={`sp-tag ${copy.tone}`}>
          {isLive ? "Live demo" : "Preview"}
        </span>
      </button>

      <div className="sp-body">
        <h3>{event?.title || copy.title}</h3>
        <p>{event?.showcaseBlurb || copy.blurb}</p>
        <button type="button" className={`sp-go ${copy.tone}`} onClick={open}>
          {isLive ? "Open this event →" : "Make one like this →"}
        </button>
        {isLive && hasDashboard && (
          <button
            type="button"
            className="sp-second"
            onClick={() => event && onOpenDemoDashboard(event._id)}
          >
            or see the organizer's side →
          </button>
        )}
      </div>
    </div>
  );
}

/** Flat, full-width, half the height of a box. The end of the page. */
function StartBar() {
  return (
    <button type="button" className="sp-startbar" onClick={startFree}>
      <span className="sp-plus" aria-hidden="true">
        +
      </span>
      <span className="sp-startcopy">
        <strong>Your event</strong>
        <span>Pick a type, share the link, take bookings. About an hour.</span>
      </span>
      <span className="sp-startgo">Start free →</span>
    </button>
  );
}
