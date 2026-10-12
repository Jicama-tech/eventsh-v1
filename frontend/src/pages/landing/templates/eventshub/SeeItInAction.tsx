import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ScrollReveal } from "../shared/ScrollReveal";
import { SeeItInActionSectionProps, ShowcaseEvent } from "../types";

/**
 * Three event boxes, a start bar, then a strip of every other curated demo —
 * the layout from the "simple" template, wearing this one's paint.
 *
 * Each box prefers a real curated showcase event (an admin sets isShowcase;
 * LandingPage does the fetch) and falls back to a drawn CSS preview when
 * there isn't one, or when the curated screenshot 404s. So the row never
 * collapses to one card, and the page never links to a demo that isn't
 * there — the previous version simply rendered nothing at all when the fetch
 * came back empty.
 *
 * Adding a use case is an admin action: flag another event as a showcase and
 * it appears. No code change, no new endpoint.
 */

type Kind = "professional" | "personal" | "conference";

const COPY: Record<
  Kind,
  { title: string; blurb: string; tone: "lime" | "pink" | "cyan" }
> = {
  professional: {
    title: "A trade show",
    blurb: "Stalls on a map. People pick one and pay.",
    tone: "lime",
  },
  personal: {
    title: "A wedding",
    blurb: "Guests reply, rooms and tables sort themselves.",
    tone: "pink",
  },
  conference: {
    title: "A conference",
    blurb: "Passes sold, then scanned at the door.",
    tone: "cyan",
  },
};

function imageFor(image: string): string {
  if (image.startsWith("http")) return image;
  return `${__API_URL__}${image.startsWith("/") ? "" : "/"}${image}`;
}

/* ---------------- drawn previews: pure CSS, no data, no network ---------- */

const SOLD = new Set(["A-01", "A-03", "A-05", "B-02", "B-04", "C-02", "C-05"]);
const STALLS = [
  "A-01", "A-02", "A-03", "A-04", "A-05", "A-06",
  "B-01", "B-02", "B-03", "B-04", "B-05", "B-06",
  "C-01", "C-02", "C-03", "C-04", "C-05", "C-06",
];

function Chrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <span className="eh-draw" aria-hidden="true">
      <span className="eh-drawbar">
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
      <span className="eh-floorprev">
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
      <span className="eh-guests">
        {guests.map(([initials, name, count]) => (
          <span className="eh-g" key={name}>
            <u>{initials}</u>
            <p>{name}</p>
            <em>{count}</em>
          </span>
        ))}
      </span>
    </Chrome>
  );
}

// A deterministic block pattern that reads as a QR code without pretending to
// be a scannable one.
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
      <span className="eh-checkin">
        <span className="eh-qr">
          {QR.map((on, i) => (
            <i key={i} className={on ? "on" : undefined} />
          ))}
        </span>
        <span className="eh-scans">
          {scans.map(([name, role]) => (
            <span className="eh-scan" key={name}>
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

function startFree() {
  window.location.assign("/organizer/login");
}

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

  // Every curated event beyond the three featured slots rides in the same
  // carousel rather than a separate strip — one moving row is easier to take
  // in than a row plus a list.
  const featured = new Set(slots.map((s) => s.event?._id).filter(Boolean));
  const extras = showcaseEvents.filter((e) => !featured.has(e._id));
  const cards: { key: string; kind: Kind; event?: ShowcaseEvent }[] = [
    ...slots.map((s) => ({ key: s.kind, kind: s.kind, event: s.event })),
    ...extras.map((e) => ({
      key: e._id,
      kind: (e.showcaseKind === "personal" ? "personal" : "professional") as Kind,
      event: e,
    })),
  ];

  // The track is rendered twice back to back so the -50% translation meets
  // itself and the loop is seamless. The duplicate is aria-hidden so screen
  // readers and the tab order see each demo once.
  const track = (dup: boolean) =>
    cards.map((c) => (
      <EventBox
        key={(dup ? "dup-" : "") + c.key}
        kind={c.kind}
        event={c.event}
        onOpenDemo={onOpenDemo}
        onOpenDemoDashboard={onOpenDemoDashboard}
      />
    ));

  return (
    <section className="eh-sec tight" id="demos">
      <div className="eh-wrap">
        <ScrollReveal>
          <div className="eh-head">
            <span className="eh-kick pink">Not a mock-up</span>
            <h2>
              Poke at a <span className="eh-swoon eh-pinkt">real one</span>.
            </h2>
            <p className="eh-lede">
              Live events running on Eventsh right now. Open one the way a
              guest would.
            </p>
          </div>
        </ScrollReveal>
      </div>

      {/* Full-bleed: the carousel runs past the wrap so cards enter and leave
          at the window edge instead of popping at a container boundary. */}
      <DemoCarousel
        first={track(false)}
        second={track(true)}
      />

      <div className="eh-wrap">
        <ScrollReveal>
          <StartBar />
        </ScrollReveal>
      </div>
    </section>
  );
}

// Auto-drifting carousel with left / right chevrons. The two halves are
// identical, so wrapping the offset by one half's width is seamless. Drift
// pauses while the pointer or focus is inside; a chevron eases the row by one
// card in either direction and the drift then carries on.
const DRIFT_PX_PER_SEC = 14;

function DemoCarousel({
  first,
  second,
}: {
  first: React.ReactNode;
  second: React.ReactNode;
}) {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const target = useRef(0);
  const paused = useRef(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced.current) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      const half = halfRef.current?.offsetWidth || 0;
      if (half > 0 && trackRef.current) {
        if (Math.abs(target.current - pos.current) > 0.5) {
          pos.current += (target.current - pos.current) * Math.min(1, dt * 8);
        } else if (!paused.current) {
          pos.current += DRIFT_PX_PER_SEC * dt;
          target.current = pos.current;
        }
        if (pos.current >= half) {
          pos.current -= half;
          target.current -= half;
        } else if (pos.current < 0) {
          pos.current += half;
          target.current += half;
        }
        trackRef.current.style.transform = `translate3d(${-pos.current}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const move = (dir: 1 | -1) => {
    const card = halfRef.current?.querySelector<HTMLElement>(".eh-box");
    const step = (card?.offsetWidth || 340) + 18;
    if (reduced.current) {
      marqueeRef.current?.scrollBy({ left: dir * step, behavior: "smooth" });
      return;
    }
    target.current = target.current + dir * step;
  };

  return (
    <div className="eh-carousel">
      <button
        type="button"
        className="eh-car-btn left"
        aria-label="Previous events"
        onClick={() => move(-1)}
      >
        <ChevronLeft size={22} />
      </button>
      <div
        ref={marqueeRef}
        className="eh-marquee"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onFocus={() => (paused.current = true)}
        onBlur={() => (paused.current = false)}
      >
        <div ref={trackRef} className="eh-track">
          <div ref={halfRef} className="eh-track-half">
            {first}
          </div>
          <div className="eh-track-half" aria-hidden="true">
            {second}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="eh-car-btn right"
        aria-label="Next events"
        onClick={() => move(1)}
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
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
    <div className="eh-box">
      <button
        type="button"
        className="eh-screen"
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
        <span className={`eh-tag ${copy.tone}`}>
          {isLive ? "Live demo" : "Preview"}
        </span>
      </button>

      <div className="eh-box-body">
        <h3>{event?.title || copy.title}</h3>
        <p>{event?.showcaseBlurb || copy.blurb}</p>
        <button
          type="button"
          className={`eh-go ${copy.tone}`}
          onClick={open}
        >
          {isLive ? "Open this event →" : "Make one like this →"}
        </button>
        {isLive && hasDashboard && (
          <button
            type="button"
            className="eh-second"
            onClick={() => event && onOpenDemoDashboard(event._id)}
          >
            or see the organizer's side →
          </button>
        )}
      </div>
    </div>
  );
}

/** Flat and full width, shorter than the boxes above: the destination, not a
 *  fourth option to compare. */
function StartBar() {
  return (
    <button type="button" className="eh-startbar" onClick={startFree}>
      <span className="eh-plus" aria-hidden="true">
        +
      </span>
      <span className="eh-startcopy">
        <strong>Your event</strong>
        <span>Pick a type, share the link, take bookings. About an hour.</span>
      </span>
      <span className="eh-startgo">Get Started →</span>
    </button>
  );
}
