import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import MarriageRsvp from "./MarriageRsvp";
import DemoPrompt from "./DemoPrompt";
import { startDemoDashboard } from "@/lib/demoDashboard";
import MarriageMonogram from "./MarriageMonogram";
import MarriageMotif from "./MarriageMotif";
import MarriageFloral from "./MarriageFloral";
import {
  resolveMarriageTheme,
  buildMarriagePalette,
  HERO_HEIGHT_CLASS,
  HERO_NAME_CLASS,
  MARRIAGE_FONTS_HREF,
  type MarriageHeadingStyle,
  type MarriageFloralStyle,
  type MarriageGalleryLayout,
  type MarriageStoryLayout,
} from "@/lib/marriageThemes";
import {
  Heart,
  Calendar,
  Share2,
  Mail,
  Phone,
  Camera,
  Check,
} from "lucide-react";

// Resolve a stored (relative) media path to an absolute URL.
const toAbs = (p?: string) =>
  p && /^https?:\/\//.test(p) ? p : p ? `${__API_URL__}${p}` : "";

// "HH:mm" -> "h:mm AM/PM"; tolerant of empty/garbage input.
const prettyTime = (t?: string) => {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const prettyDate = (d?: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : format(dt, "EEEE, MMMM d, yyyy");
};

interface MarriageFunctionItem {
  id?: string;
  name?: string;
  date?: string;
  time?: string;
  endTime?: string;
  venueName?: string;
  address?: string;
  dressCode?: string;
  notes?: string;
  isLive?: boolean;
  announcedAt?: string;
}

interface MarriageEventFrontProps {
  eventData: any;
}

// A page-wide floral layer: sprays scattered down BOTH side edges of the whole
// page (behind the content), so the design decorates the full invitation, not
// just the hero. `dense` (frame mode) adds a second, offset set of sprays.
function PageFlorals({
  variant,
  dense,
  color,
}: {
  variant: MarriageFloralStyle;
  dense: boolean;
  color: string;
}) {
  const base: {
    top: string;
    side: "left" | "right";
    pos: "tl" | "tr" | "bl" | "br";
  }[] = [
    { top: "14%", side: "left", pos: "tl" },
    { top: "29%", side: "right", pos: "tr" },
    { top: "45%", side: "left", pos: "bl" },
    { top: "60%", side: "right", pos: "br" },
    { top: "75%", side: "left", pos: "tl" },
    { top: "90%", side: "right", pos: "tr" },
  ];
  const extra: typeof base = [
    { top: "21%", side: "right", pos: "br" },
    { top: "37%", side: "left", pos: "tl" },
    { top: "53%", side: "right", pos: "tr" },
    { top: "68%", side: "left", pos: "bl" },
    { top: "83%", side: "right", pos: "br" },
  ];
  const spots = dense ? [...base, ...extra] : base;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden lg:block"
      style={{ color }}
      aria-hidden
    >
      {spots.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{ top: s.top, [s.side]: 0 } as React.CSSProperties}
        >
          <MarriageFloral
            position={s.pos}
            variant={variant}
            size={185}
            className="opacity-50"
          />
        </div>
      ))}
    </div>
  );
}

// Deterministic petal parameters (no Math.random → stable across renders).
const PETAL_DATA = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 5.7 + (i % 4) * 6) % 100,
  size: 9 + (i % 4) * 4,
  dur: 9 + (i % 6) * 1.7,
  delay: -((i * 1.3) % 12),
  drift: (i % 2 ? 1 : -1) * (28 + (i % 5) * 16),
  op: 0.5 + (i % 3) * 0.13,
  accent: i % 2 === 0,
  round: i % 3 === 0 ? "150% 0 150% 0" : "50% 0 50% 50%",
}));

// A gentle shower of petals drifting down the whole viewport — the signature
// romantic "wow". Fixed so they keep falling as guests scroll; pointer-events
// off; auto-disabled under prefers-reduced-motion (via the injected CSS).
function FallingPetals() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
      aria-hidden
    >
      {PETAL_DATA.map((p, i) => (
        <span
          key={i}
          className="wed-petal"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              borderRadius: p.round,
              background: p.accent ? "var(--w-accent)" : "var(--w-primary)",
              "--pdur": `${p.dur}s`,
              "--pdel": `${p.delay}s`,
              "--pd": `${p.drift}px`,
              "--po": p.op,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Public, wedding-themed event page. Rendered by eventFront.tsx when an
 * event's eventType is "personal" + "Marriage Function". Reads the same
 * fetched event document (couple details on `marriage`, ceremonies on
 * `functions`, banner/gallery, organizer) and presents it as a romantic
 * invitation rather than the commercial ticketing layout.
 *
 * The entire look is driven by `marriage.theme` (set by the organizer in the
 * form's Design tab): colors/fonts come through the `--w-*` CSS variables from
 * buildMarriagePalette, while structural choices (hero size/layout, section
 * visibility, heading style, background pattern, animations) are read straight
 * off the resolved theme. A missing theme falls back to Classic Rose, so
 * existing weddings look exactly as before.
 */
export default function MarriageEventFront({
  eventData,
}: MarriageEventFrontProps) {
  const marriage = eventData?.marriage || {};
  const organizer = eventData?.organizer || {};

  // Resolve the organizer's design choices: `theme` drives structure,
  // `palette` (CSS vars) drives colors/fonts.
  const theme = useMemo(
    () => resolveMarriageTheme(marriage?.theme),
    [marriage?.theme],
  );
  const palette = useMemo(() => buildMarriagePalette(theme), [theme]);
  // Demo mode: admin-curated showcase wedding. RSVP invites register/contact.
  const isDemo = (eventData as any)?.isDemo === true;
  const [showDemoPrompt, setShowDemoPrompt] = useState(false);

  // Load the wedding display fonts once (only on this public page).
  useEffect(() => {
    const id = "marriage-eventfront-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = MARRIAGE_FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  const partner1 = (marriage.partner1Name || "").trim();
  const partner2 = (marriage.partner2Name || "").trim();
  const coupleLine =
    partner1 && partner2
      ? [partner1, partner2]
      : [eventData?.title || "Our Wedding"];

  const functions: MarriageFunctionItem[] = useMemo(() => {
    const list = Array.isArray(eventData?.functions) ? eventData.functions : [];
    return [...list]
      .filter((f) => (f?.name || "").trim())
      .sort((a, b) => String(a?.date || "").localeCompare(String(b?.date || "")));
  }, [eventData]);

  const gallery: string[] = useMemo(() => {
    const g = Array.isArray(eventData?.gallery) ? eventData.gallery : [];
    return g.map((u: string) => toAbs(u)).filter(Boolean);
  }, [eventData]);

  // The ceremony the couple has announced as "started" drives the live
  // announcement bar at the top of the page. If several are live, the most
  // recently announced wins.
  const liveFunction: MarriageFunctionItem | null = useMemo(() => {
    const list: MarriageFunctionItem[] = Array.isArray(eventData?.functions)
      ? eventData.functions
      : [];
    const live = list.filter((f) => f?.isLive && (f?.name || "").trim());
    if (live.length === 0) return null;
    return [...live].sort((a, b) =>
      String(b?.announcedAt || "").localeCompare(String(a?.announcedAt || "")),
    )[0];
  }, [eventData]);

  const adBarBg = (marriage.adBarBgColor || "").trim() || theme.primaryColor;
  const adBarTextColor = (marriage.adBarTextColor || "").trim() || "#ffffff";
  const adBarText = (() => {
    if (!liveFunction) return "";
    const apply = (t: string) =>
      t
        .replace(/\{function\}/gi, liveFunction.name || "")
        .replace(/\{venue\}/gi, liveFunction.venueName || "")
        .replace(/\{time\}/gi, prettyTime(liveFunction.time) || "");
    const custom = (marriage.adBarMessage || "").trim();
    return custom ? apply(custom) : `${liveFunction.name} has started!`;
  })();
  const adBarMapsHref = (() => {
    if (!liveFunction) return "";
    const q = [liveFunction.venueName, liveFunction.address]
      .filter(Boolean)
      .join(" ")
      .trim();
    return q
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
      : "";
  })();
  // The full scrolling line for the marquee (message + time · venue).
  const adBarLine = (() => {
    if (!liveFunction) return "";
    const details = [prettyTime(liveFunction.time), liveFunction.venueName]
      .filter(Boolean)
      .join("  ·  ");
    return [`🎉 ${adBarText}`, details].filter(Boolean).join("     ·     ");
  })();

  const bannerUrl = toAbs(eventData?.image);

  // The "main" wedding date drives the hero + countdown: earliest dated
  // ceremony, falling back to the event's startDate.
  const mainDate = useMemo(() => {
    const firstDated = functions.find((f) => f.date)?.date;
    return firstDated || eventData?.startDate || "";
  }, [functions, eventData]);

  // Live countdown to the main date.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const countdown = useMemo(() => {
    if (!mainDate) return null;
    const target = new Date(mainDate).getTime();
    if (isNaN(target)) return null;
    const diff = target - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hours, mins, secs };
  }, [mainDate, now]);

  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    try {
      const url = window.location.href;
      if (navigator.share) {
        await navigator.share({ title: eventData?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user dismissed share sheet — non-fatal */
    }
  };

  const inviteLink = (eventData?.inviteLink || "").trim();
  const orgName = organizer?.organizationName || organizer?.name || "";
  const hostLine = (marriage.hostNames || "").trim();
  const tagline = (theme.heroTagline || "").trim();
  const showMonogram =
    theme.showMonogram && Boolean(partner1.trim() || partner2.trim());

  const storyTimeline = Array.isArray((marriage as any).storyTimeline)
    ? ((marriage as any).storyTimeline as Array<{
        id?: string;
        title?: string;
        date?: string;
        content?: string;
        image?: string;
      }>)
    : [];
  const hasStory =
    (marriage.howWeMet || "").trim() ||
    (marriage.ourStory || "").trim() ||
    storyTimeline.length > 0;
  const hasContact =
    (marriage.contactName || "").trim() ||
    (marriage.contactPhone || "").trim() ||
    (marriage.contactEmail || "").trim();

  // Heading style helper — every display heading uses the chosen heading font.
  const headingStyle = { fontFamily: "var(--w-heading-font)" };
  // Soft glow behind the couple's names when over a photo, for legibility.
  const heroNameStyle = bannerUrl
    ? { ...headingStyle, textShadow: "0 2px 26px rgba(0,0,0,0.38)" }
    : headingStyle;
  const heroNameClass = HERO_NAME_CLASS[theme.fontScale];
  const sec = theme.sections;
  // Gentle fade-up on the hero + each section when animations are enabled.
  // (CSS keyframes are injected once at module load, below.)
  const revealAttr = theme.animations
    ? ({ "data-wed-reveal": "" } as const)
    : {};
  // The below-hero sections inherit the design template's "family" so the whole
  // page reads as one design, not just a styled hero.
  const sectionFamily = sectionFamilyFor(theme.layoutTemplate);

  // ---- Hero design templates -------------------------------------------
  // Shared building blocks below are composed differently per
  // `theme.layoutTemplate` so a single choice restyles the whole hero.
  const heroHeightCls = HERO_HEIGHT_CLASS[theme.heroHeight];
  const onHeroColor = bannerUrl ? "var(--w-on-hero)" : "var(--w-text)";

  // Full-bleed background: photo + gradient, or a soft palette gradient.
  const heroBackdrop = (strong = false) =>
    bannerUrl ? (
      <>
        <div
          className="wed-kb absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: strong
              ? "linear-gradient(to top, rgba(0,0,0,0.74), rgba(0,0,0,0.32) 55%, rgba(0,0,0,0.22))"
              : "linear-gradient(to bottom, rgba(0,0,0,calc(var(--w-hero-overlay) * 0.85)), rgba(0,0,0,calc(var(--w-hero-overlay) * 0.65)), rgba(0,0,0,var(--w-hero-overlay)))",
          }}
        />
      </>
    ) : (
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, var(--w-primary-soft), var(--w-bg) 55%, var(--w-accent-soft))",
        }}
      />
    );

  const heroFlorals = theme.floralAccents !== "none" && (
    <div
      className="absolute inset-0 z-[1]"
      style={{ color: bannerUrl ? "var(--w-on-hero)" : "var(--w-primary)" }}
    >
      <MarriageFloral position="tl" variant={theme.floralStyle} className="opacity-80" />
      <MarriageFloral position="br" variant={theme.floralStyle} className="opacity-80" />
      {theme.floralAccents === "frame" && (
        <>
          <MarriageFloral position="tr" variant={theme.floralStyle} className="opacity-80" />
          <MarriageFloral position="bl" variant={theme.floralStyle} className="opacity-80" />
        </>
      )}
    </div>
  );

  // Core hero content (kicker → names → tagline → date → ornament → cue),
  // aligned per template. Options let each template drop the parts it renders
  // itself, so custom eyebrows/dates never double up.
  const heroCore = (
    align: "center" | "left" = "center",
    opts: {
      decor?: boolean;
      kicker?: boolean;
      date?: boolean;
      ornament?: boolean;
    } = {},
  ) => {
    const {
      decor = true,
      kicker: showKicker = true,
      date: showDate = true,
      ornament: showOrnament = true,
    } = opts;
    const items =
      align === "left" ? "items-start text-left" : "items-center text-center";
    const kicker = align === "left" ? "justify-start" : "justify-center";
    const namesWrap = align === "left" ? "items-start" : "items-center";
    return (
      <div className={`flex flex-col ${items}`}>
        {decor && theme.topMotif !== "none" && (
          <MarriageMotif variant={theme.topMotif} className="mb-3" />
        )}
        {decor && showMonogram && (
          <MarriageMonogram
            left={partner1}
            right={partner2}
            variant={theme.monogramStyle}
            className="mb-6"
          />
        )}
        {showKicker && (
          <p
            className={`mb-6 flex items-center ${kicker} gap-3 text-xs uppercase tracking-[0.35em] opacity-90`}
          >
            <span className="h-px w-10 bg-current opacity-50" />
            Together with their families
            <span className="h-px w-10 bg-current opacity-50" />
          </p>
        )}
        {theme.heroLayout === "inline" && coupleLine.length > 1 ? (
          <h1
            style={heroNameStyle}
            className={`${heroNameClass} font-light leading-tight tracking-wide`}
          >
            {coupleLine[0]}{" "}
            <span style={{ color: "var(--w-primary)" }}>&amp;</span>{" "}
            {coupleLine[1]}
          </h1>
        ) : (
          <div className={`flex flex-col ${namesWrap} gap-2 sm:gap-4`}>
            {coupleLine.map((name, i) => (
              <div
                key={i}
                className={`flex flex-col ${namesWrap} gap-2 sm:gap-4`}
              >
                <h1
                  style={heroNameStyle}
                  className={`${heroNameClass} font-light leading-tight tracking-wide`}
                >
                  {name}
                </h1>
                {i === 0 && coupleLine.length > 1 && (
                  <span
                    style={{ ...headingStyle, color: "var(--w-primary)" }}
                    className="text-3xl italic sm:text-4xl"
                  >
                    &amp;
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {tagline && (
          <p className="mt-4 text-base uppercase tracking-[0.3em] opacity-90 sm:text-lg">
            {tagline}
          </p>
        )}
        {showDate && mainDate && (
          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-current/30 px-5 py-2 text-sm tracking-wide sm:text-base">
            <Heart className="h-4 w-4 fill-current" />
            {prettyDate(mainDate)}
          </p>
        )}
        {showOrnament && <Ornament className="mt-8 opacity-90" />}
      </div>
    );
  };

  const renderHero = () => {
    const t = theme.layoutTemplate;

    // SPLIT — banner one side, content panel the other.
    if (t === "split") {
      return (
        <header
          className={`relative grid ${heroHeightCls} grid-cols-1 overflow-hidden md:grid-cols-2`}
        >
          <div className="relative min-h-[38vh] md:min-h-0">
            {bannerUrl ? (
              <div
                className="wed-kb absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--w-primary), var(--w-accent))",
                }}
              />
            )}
          </div>
          <div
            className="relative flex items-center px-8 py-12 sm:px-12"
            style={{ background: "var(--w-bg)", color: "var(--w-text)" }}
          >
            {theme.floralAccents !== "none" && (
              <div
                className="absolute inset-0 z-[1]"
                style={{ color: "var(--w-primary)" }}
              >
                <MarriageFloral position="tr" variant={theme.floralStyle} className="opacity-70" />
                <MarriageFloral position="bl" variant={theme.floralStyle} className="opacity-70" />
              </div>
            )}
            <div
              {...revealAttr}
              className="relative z-10 mx-auto w-full max-w-md"
            >
              {/* Emblem centered over the (left-aligned) text column. */}
              {(theme.topMotif !== "none" || showMonogram) && (
                <div className="mb-6 flex flex-col items-center">
                  {theme.topMotif !== "none" && (
                    <MarriageMotif
                      variant={theme.topMotif}
                      className={showMonogram ? "mb-3" : ""}
                    />
                  )}
                  {showMonogram && (
                    <MarriageMonogram
                      left={partner1}
                      right={partner2}
                      variant={theme.monogramStyle}
                    />
                  )}
                </div>
              )}
              {heroCore("center", { decor: false })}
            </div>
          </div>
        </header>
      );
    }

    // CINEMA — letterboxed, content anchored bottom-left.
    if (t === "cinema") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-end overflow-hidden`}
        >
          {heroBackdrop(true)}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[7vh] bg-black/75" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7vh] bg-black/75" />
          <div
            {...revealAttr}
            className="relative z-10 mx-auto w-full max-w-5xl px-8 pb-[12vh]"
            style={{ color: "var(--w-on-hero)" }}
          >
            {heroCore("left", { decor: false })}
          </div>
        </header>
      );
    }

    // EDITORIAL — airy masthead, left-aligned, thin rules.
    if (t === "editorial") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center overflow-hidden`}
        >
          {bannerUrl ? (
            <>
              <div
                className="wed-kb absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "var(--w-bg)", opacity: 0.7 }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: "var(--w-bg)" }}
            />
          )}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto w-full max-w-4xl px-8"
            style={{ color: "var(--w-text)" }}
          >
            <div
              className="h-px w-full"
              style={{ background: "var(--w-primary-border)" }}
            />
            <div className="py-8">{heroCore("left")}</div>
            <div
              className="h-px w-full"
              style={{ background: "var(--w-primary-border)" }}
            />
          </div>
        </header>
      );
    }

    // MINIMAL — whisper-quiet, no ornament, generous whitespace.
    if (t === "minimal") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
          style={{ background: "var(--w-bg)" }}
        >
          {bannerUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20"
              style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
            />
          )}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-2xl px-6 text-center"
            style={{ color: "var(--w-text)" }}
          >
            <p className="mb-10 text-[11px] uppercase tracking-[0.5em] opacity-70">
              Together with their families
            </p>
            <h1
              style={heroNameStyle}
              className="text-3xl font-light uppercase tracking-[0.25em] sm:text-5xl"
            >
              {coupleLine.join("  &  ")}
            </h1>
            <span
              className="mx-auto mt-8 block h-px w-16"
              style={{ background: "var(--w-primary)" }}
            />
            {mainDate && (
              <p className="mt-8 text-sm uppercase tracking-[0.35em] opacity-80">
                {prettyDate(mainDate)}
              </p>
            )}
          </div>
        </header>
      );
    }

    // DECO — Art-Deco double gold frame around centered names.
    if (t === "deco") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
        >
          {heroBackdrop()}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-2xl px-6"
            style={{ color: onHeroColor }}
          >
            <div className="relative p-8 sm:p-12">
              <span
                className="pointer-events-none absolute inset-0 border-2"
                style={{ borderColor: "var(--w-accent)" }}
              />
              <span
                className="pointer-events-none absolute inset-[6px] border"
                style={{ borderColor: "var(--w-accent)", opacity: 0.6 }}
              />
              {heroCore("center")}
            </div>
          </div>
        </header>
      );
    }

    // GILDED — bordered card panel floating over the banner.
    if (t === "gilded") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden px-6`}
        >
          {heroBackdrop()}
          {heroFlorals}
          <div {...revealAttr} className="relative z-10 mx-auto w-full max-w-xl">
            <div
              className="border p-8 shadow-2xl sm:p-12"
              style={{
                background: "var(--w-surface)",
                color: "var(--w-text)",
                borderColor: "var(--w-primary-border)",
                borderRadius: "var(--w-radius)",
              }}
            >
              {heroCore("center")}
            </div>
          </div>
        </header>
      );
    }

    // ATELIER — the signature editorial look: centered names framed by thin
    // gold hairline rules, an "The wedding of" eyebrow, generous spacing.
    if (t === "atelier") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
        >
          {heroBackdrop()}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-3xl px-6 text-center"
            style={{ color: onHeroColor }}
          >
            {theme.topMotif !== "none" && (
              <MarriageMotif variant={theme.topMotif} className="mb-4" />
            )}
            <p className="mb-6 text-[11px] uppercase tracking-[0.5em] opacity-80">
              The wedding of
            </p>
            <span
              className="mx-auto mb-8 block h-px w-24"
              style={{ background: "var(--w-accent)" }}
            />
            {theme.heroLayout === "inline" && coupleLine.length > 1 ? (
              <h1
                style={heroNameStyle}
                className={`${heroNameClass} font-light leading-tight tracking-wide`}
              >
                {coupleLine[0]}{" "}
                <span style={{ color: "var(--w-primary)" }}>&amp;</span>{" "}
                {coupleLine[1]}
              </h1>
            ) : (
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                {coupleLine.map((name, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <h1
                      style={heroNameStyle}
                      className={`${heroNameClass} font-light leading-tight tracking-wide`}
                    >
                      {name}
                    </h1>
                    {i === 0 && coupleLine.length > 1 && (
                      <span
                        style={{ ...headingStyle, color: "var(--w-primary)" }}
                        className="text-2xl italic sm:text-3xl"
                      >
                        &amp;
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <span
              className="mx-auto mt-8 block h-px w-24"
              style={{ background: "var(--w-accent)" }}
            />
            {mainDate && (
              <p className="mt-6 text-sm uppercase tracking-[0.4em] opacity-85 sm:text-base">
                {prettyDate(mainDate)}
              </p>
            )}
            {tagline && (
              <p className="mt-3 text-xs uppercase tracking-[0.3em] opacity-70">
                {tagline}
              </p>
            )}
          </div>
        </header>
      );
    }

    // IVORY — bright, airy warm wash. Photo kept light (not darkened) so the
    // page reads soft and luminous; centered names in the theme text colour.
    if (t === "ivory") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
          style={{ background: "var(--w-bg)" }}
        >
          {bannerUrl && (
            <>
              <div
                className="wed-kb absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "var(--w-bg)", opacity: 0.62 }}
              />
            </>
          )}
          {heroFlorals}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-3xl px-6"
            style={{ color: "var(--w-text)" }}
          >
            {heroCore("center")}
          </div>
        </header>
      );
    }

    // FOLIO — book title-page: a thin double-ruled border around the names,
    // flat (no shadow), with a small caption, like a printed programme cover.
    if (t === "folio") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden px-6`}
        >
          {heroBackdrop()}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto w-full max-w-xl"
            style={{ color: onHeroColor }}
          >
            <div
              className="relative px-8 py-10 sm:px-12 sm:py-14"
              style={{ outline: "1px solid var(--w-accent)", outlineOffset: 6 }}
            >
              <span
                className="pointer-events-none absolute inset-0 border"
                style={{ borderColor: "var(--w-accent)" }}
              />
              <p className="mb-6 text-center text-[11px] uppercase tracking-[0.45em] opacity-80">
                — The Wedding —
              </p>
              {heroCore("center", { decor: false, kicker: false })}
            </div>
          </div>
        </header>
      );
    }

    // PORTRAIT — a matted, framed portrait of the couple with their names set
    // BENEATH the photo (gallery-print feel) rather than overlaid on it.
    if (t === "portrait") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden px-6 py-12`}
          style={{ background: "var(--w-bg)" }}
        >
          {heroFlorals}
          <div
            {...revealAttr}
            className="relative z-10 w-full max-w-sm text-center"
            style={{ color: "var(--w-text)" }}
          >
            <div
              className="mx-auto p-2 shadow-xl"
              style={{
                background: "var(--w-surface)",
                border: "1px solid var(--w-primary-border)",
              }}
            >
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: "3 / 4" }}
              >
                {bannerUrl ? (
                  <div
                    className="wed-kb absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(160deg, var(--w-primary), var(--w-accent))",
                    }}
                  />
                )}
              </div>
            </div>
            <div className="mt-6">{heroCore("center", { decor: false })}</div>
          </div>
        </header>
      );
    }

    // ROYAL — ornate, regal: heavy gold double frame with corner flourishes,
    // mandala monogram + top motif emphasised, over the banner.
    if (t === "royal") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden px-6`}
        >
          {heroBackdrop()}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto w-full max-w-2xl"
            style={{ color: onHeroColor }}
          >
            <div
              className="relative px-6 py-10 sm:px-12 sm:py-14"
              style={{ border: "3px double var(--w-accent)" }}
            >
              {/* corner flourishes */}
              {(["tl", "tr", "bl", "br"] as const).map((c) => (
                <span
                  key={c}
                  className="pointer-events-none absolute h-5 w-5"
                  style={{
                    borderColor: "var(--w-accent)",
                    top: c[0] === "t" ? -3 : "auto",
                    bottom: c[0] === "b" ? -3 : "auto",
                    left: c[1] === "l" ? -3 : "auto",
                    right: c[1] === "r" ? -3 : "auto",
                    borderTop: c[0] === "t" ? "3px solid" : undefined,
                    borderBottom: c[0] === "b" ? "3px solid" : undefined,
                    borderLeft: c[1] === "l" ? "3px solid" : undefined,
                    borderRight: c[1] === "r" ? "3px solid" : undefined,
                  }}
                />
              ))}
              {theme.topMotif !== "none" ? (
                <MarriageMotif variant={theme.topMotif} className="mb-2" />
              ) : (
                <MarriageMonogram
                  left={partner1}
                  right={partner2}
                  variant="mandala"
                  className="mb-2"
                />
              )}
              {heroCore("center", { decor: false })}
            </div>
          </div>
        </header>
      );
    }

    // BOHO — soft, organic and warm: floral frame on all corners, a rounded
    // pill kicker, light and airy over a gentle wash.
    if (t === "boho") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
        >
          {bannerUrl ? (
            <>
              <div
                className="wed-kb absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "var(--w-bg)", opacity: 0.5 }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 30% 20%, var(--w-primary-soft), transparent 60%), radial-gradient(circle at 75% 80%, var(--w-accent-soft), transparent 55%), var(--w-bg)",
              }}
            />
          )}
          <div className="absolute inset-0 z-[1]" style={{ color: "var(--w-primary)" }}>
            <MarriageFloral position="tl" variant={theme.floralStyle} className="opacity-80" />
            <MarriageFloral position="tr" variant={theme.floralStyle} className="opacity-80" />
            <MarriageFloral position="bl" variant={theme.floralStyle} className="opacity-80" />
            <MarriageFloral position="br" variant={theme.floralStyle} className="opacity-80" />
          </div>
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-2xl px-6 text-center"
            style={{ color: "var(--w-text)" }}
          >
            <span
              className="mb-5 inline-block rounded-full px-4 py-1 text-[11px] uppercase tracking-[0.3em]"
              style={{
                background: "var(--w-primary-soft)",
                color: "var(--w-primary)",
              }}
            >
              We're getting married
            </span>
            {heroCore("center", { decor: false, kicker: false })}
          </div>
        </header>
      );
    }

    // POSTER — bold, contemporary: an oversized single line of names, strong
    // type, a thick accent underline. Modern event-poster energy.
    if (t === "poster") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
        >
          {heroBackdrop(true)}
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-4xl px-6 text-center"
            style={{ color: "var(--w-on-hero)" }}
          >
            <p className="mb-4 text-xs uppercase tracking-[0.5em] opacity-85">
              Save the date
            </p>
            <h1
              style={heroNameStyle}
              className="text-5xl font-semibold uppercase leading-[0.95] tracking-tight sm:text-8xl"
            >
              {partner1}
              <span className="block" style={{ color: "var(--w-primary)" }}>
                &amp; {partner2}
              </span>
            </h1>
            <span
              className="mx-auto mt-6 block h-1.5 w-24"
              style={{ background: "var(--w-primary)" }}
            />
            {mainDate && (
              <p className="mt-6 text-lg font-medium tracking-wide sm:text-2xl">
                {prettyDate(mainDate)}
              </p>
            )}
          </div>
        </header>
      );
    }

    // VINTAGE — timeless parchment feel: an oval-framed portrait vignette with
    // "est." date and classic serif names beneath.
    if (t === "vintage") {
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden px-6 py-12`}
          style={{
            background:
              "radial-gradient(circle at center, var(--w-surface), var(--w-bg))",
          }}
        >
          {heroFlorals}
          <div
            {...revealAttr}
            className="relative z-10 w-full max-w-md text-center"
            style={{ color: "var(--w-text)" }}
          >
            <div
              className="relative mx-auto mb-6 overflow-hidden"
              style={{
                width: "min(58vw, 15rem)",
                aspectRatio: "4 / 5",
                borderRadius: "50%",
                border: "2px solid var(--w-accent)",
                boxShadow: "0 0 0 6px var(--w-primary-tint)",
              }}
            >
              {bannerUrl ? (
                <div
                  className="wed-kb absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${bannerUrl})`, filter: "var(--w-hero-filter)" }}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(160deg, var(--w-primary), var(--w-accent))",
                  }}
                />
              )}
            </div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.4em] opacity-70">
              Est. {mainDate ? prettyDate(mainDate) : "Our Day"}
            </p>
            {heroCore("center", { decor: false, kicker: false, date: false })}
          </div>
        </header>
      );
    }

    // COLLAGE — a photo mosaic (banner + gallery) behind a translucent panel
    // holding the names. Falls back to a palette gradient when no photos.
    if (t === "collage") {
      const imgs = [bannerUrl, ...gallery].filter(Boolean).slice(0, 4);
      return (
        <header
          className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
        >
          {imgs.length > 0 ? (
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${imgs[i % imgs.length]})`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--w-primary), var(--w-accent))",
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/45" />
          <div
            {...revealAttr}
            className="relative z-10 mx-auto max-w-md px-6"
          >
            <div
              className="px-6 py-8 text-center backdrop-blur-sm"
              style={{
                background: "rgba(0,0,0,0.28)",
                color: "var(--w-on-hero)",
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: "var(--w-radius)",
              }}
            >
              {heroCore("center", { decor: false })}
            </div>
          </div>
        </header>
      );
    }

    // CLASSIC (default) — centered names over a full banner.
    return (
      <header
        className={`relative flex ${heroHeightCls} items-center justify-center overflow-hidden`}
      >
        {heroBackdrop()}
        {heroFlorals}
        <div
          {...revealAttr}
          className="relative z-10 mx-auto max-w-3xl px-6"
          style={{ color: onHeroColor }}
        >
          {heroCore("center")}
        </div>
      </header>
    );
  };

  return (
    <div
      style={{
        ...palette.vars,
        // Pattern tiles over the page background; opaque sections cover it
        // locally, which reads as a patterned base with solid cards.
        background: "var(--w-pattern-image), var(--w-bg)",
        backgroundSize: "var(--w-pattern-size), auto",
        backgroundRepeat: "repeat, no-repeat",
        backgroundAttachment: "fixed, scroll",
        color: "var(--w-text)",
        fontFamily: "var(--w-body-font)",
      }}
      className="relative min-h-screen"
      data-wed-anim={theme.animations ? "" : undefined}
    >
      {/* Page-wide floral decoration — scattered down both side edges of the
          whole page (behind the content) when floral framing is on. */}
      {theme.floralAccents !== "none" && (
        <PageFlorals
          variant={theme.floralStyle}
          dense={theme.floralAccents === "frame"}
          color={palette.isDark ? "rgba(255,255,255,0.92)" : "var(--w-primary)"}
        />
      )}
      {/* Falling petals — the ambient romantic effect (opt-in). */}
      {theme.fallingPetals && <FallingPetals />}
      <DemoPrompt
        open={showDemoPrompt}
        onClose={() => setShowDemoPrompt(false)}
      />
      <div className="relative z-10">
        {isDemo && (
          <div className="sticky top-0 z-[80] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-indigo-600 px-4 py-1.5 text-center text-xs font-semibold text-white">
            Live demo — this is an example wedding page.
            {((eventData as any)?.showcaseMode === "dashboard" ||
              (eventData as any)?.showcaseMode === "both") && (
              <button
                onClick={() => startDemoDashboard((eventData as any)?._id)}
                className="rounded-full bg-white/20 px-2.5 py-0.5 hover:bg-white/30"
              >
                See the dashboard →
              </button>
            )}
            <button
              onClick={() => setShowDemoPrompt(true)}
              className="underline underline-offset-2 hover:opacity-90"
            >
              Create your own
            </button>
          </div>
        )}
      {/* ---------------- LIVE ANNOUNCEMENT BAR ----------------
          Shows when the couple marks a ceremony "started". Sticky so guests
          scrolling the page always see what's happening now. */}
      {liveFunction && (
        <div
          className="sticky top-0 z-[60] flex items-center shadow-md"
          style={{ background: adBarBg, color: adBarTextColor }}
        >
          {/* Blinking LIVE badge — pinned (non-scrolling) at the left. */}
          <span className="animate-flicker ml-3 mr-1 flex flex-shrink-0 items-center gap-1.5 rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-current" />
            Live
          </span>
          {/* Continuously scrolling message. The track is two IDENTICAL halves,
              each repeating the line several times so a half is always wider
              than the bar — the -50% keyframe then loops with no blank gap,
              regardless of message length or screen width. Pauses on hover. */}
          <div className="relative flex-1 overflow-hidden py-2.5">
            <div
              className="flex w-max animate-marquee whitespace-nowrap text-sm font-semibold hover:[animation-play-state:paused]"
              style={{ animationDuration: "40s" }}
            >
              {[0, 1].map((half) => (
                <div key={half} className="flex" aria-hidden={half === 1}>
                  {[0, 1, 2, 3].map((k) => (
                    <span key={k} className="px-10">
                      {adBarLine}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {/* Directions stays pinned (non-moving) so it's always clickable. */}
          {adBarMapsHref && (
            <a
              href={adBarMapsHref}
              target="_blank"
              rel="noreferrer"
              className="mr-3 inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-xs font-medium transition hover:bg-white/40"
            >
              Directions
            </a>
          )}
        </div>
      )}

      {/* Floating share button — drops below the announcement bar when it's
          showing so the bar never covers it. */}
      <button
        onClick={handleShare}
        style={{ background: "var(--w-surface)", color: "var(--w-primary)" }}
        className={`fixed right-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition hover:opacity-90 ${
          liveFunction ? "top-16" : "top-4"
        }`}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" /> Copied
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> Share
          </>
        )}
      </button>

      {/* ---------------- HERO (design-template aware) ---------------- */}
      {renderHero()}

      {/* ---------------- COUNTDOWN ---------------- */}
      {sec.countdown && countdown && (
        <section
          {...revealAttr}
          className="py-12"
          style={{ background: "var(--w-surface)" }}
        >
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p
              className="mb-2 text-xs uppercase tracking-[0.35em]"
              style={{ color: "var(--w-primary)" }}
            >
              Counting down to forever
            </p>
            <Ornament
              className="mx-auto mb-7"
              style={{ color: "var(--w-primary)" }}
            />
            <div className="flex items-center justify-center gap-4 sm:gap-7">
              {[
                { v: countdown.days, l: "Days" },
                { v: countdown.hours, l: "Hours" },
                { v: countdown.mins, l: "Minutes" },
                { v: countdown.secs, l: "Seconds" },
              ].map((b, i) => (
                <div
                  key={b.l}
                  className="flex items-center gap-4 sm:gap-7"
                >
                  {i > 0 && (
                    <span
                      className="h-1.5 w-1.5 rotate-45"
                      style={{ background: "var(--w-accent)" }}
                    />
                  )}
                  <div className="flex flex-col items-center">
                    <span
                      style={headingStyle}
                      className="text-4xl font-light leading-none sm:text-6xl"
                    >
                      {String(b.v).padStart(2, "0")}
                    </span>
                    <span className="mt-2 text-[10px] uppercase tracking-[0.2em] opacity-60 sm:text-xs">
                      {b.l}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- WELCOME NOTE ---------------- */}
      {sec.welcome && (eventData?.description || hostLine) && (
        <section {...revealAttr} className="py-16">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <Ornament
              className="mx-auto mb-7"
              style={{ color: "var(--w-primary)" }}
            />
            {eventData?.description && (
              <p
                style={headingStyle}
                className="text-2xl font-light italic leading-relaxed sm:text-3xl"
              >
                &ldquo;{eventData.description}&rdquo;
              </p>
            )}
            {hostLine && (
              <p
                className="mt-7 text-sm uppercase tracking-[0.2em]"
                style={{ color: "var(--w-muted)" }}
              >
                With love, {hostLine}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------------- OUR STORY ---------------- */}
      {sec.story && hasStory && (
        <section
          {...revealAttr}
          className="py-16"
          style={{
            background:
              "linear-gradient(to bottom, var(--w-primary-soft), transparent)",
          }}
        >
          <div className="mx-auto max-w-4xl px-6">
            <SectionHeading
              icon={<Heart className="h-5 w-5" />}
              label="Our Story"
              variant={theme.headingStyle}
              family={sectionFamily}
            />

            {(marriage.howWeMet || "").trim() && (
              <div className="mx-auto mt-10 max-w-2xl text-center">
                <h3 style={headingStyle} className="mb-3 text-2xl">
                  How we met
                </h3>
                <p className="whitespace-pre-line text-lg font-light leading-relaxed opacity-90">
                  {marriage.howWeMet}
                </p>
              </div>
            )}

            {storyTimeline.length > 0 ? (
              <StoryTimeline
                moments={storyTimeline as StoryMomentView[]}
                layout={theme.storyLayout}
              />
            ) : (
              // ── Legacy single "Our journey" paragraph ──
              (marriage.ourStory || "").trim() && (
                <div className="mx-auto mt-10 max-w-2xl text-center">
                  <h3 style={headingStyle} className="mb-3 text-2xl">
                    Our journey
                  </h3>
                  <p className="whitespace-pre-line text-lg font-light leading-relaxed opacity-90">
                    {marriage.ourStory}
                  </p>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {/* ---------------- CEREMONIES / FUNCTIONS ---------------- */}
      {sec.ceremonies && functions.length > 0 && (
        <section {...revealAttr} className="py-16">
          <div className="mx-auto max-w-4xl px-6">
            <SectionHeading
              icon={<Calendar className="h-5 w-5" />}
              label="Wedding Events"
              variant={theme.headingStyle}
              family={sectionFamily}
            />
            <div className="mt-12 space-y-8">
              {functions.map((fn, idx) => {
                const timeText = [prettyTime(fn.time), prettyTime(fn.endTime)]
                  .filter(Boolean)
                  .join(" – ");
                const whenText = [prettyDate(fn.date), timeText]
                  .filter(Boolean)
                  .join("  ·  ");
                return (
                  <div
                    key={fn.id || idx}
                    className="relative mx-auto max-w-2xl px-8 py-9 text-center transition duration-300 hover:-translate-y-0.5 sm:px-12 sm:py-11"
                    style={{
                      background: "var(--w-surface)",
                      border: "1px solid var(--w-primary-border)",
                      borderRadius: "var(--w-radius)",
                      boxShadow: "0 18px 50px -34px var(--w-primary)",
                    }}
                  >
                    {/* small motif */}
                    <span
                      className="mx-auto mb-4 block h-2 w-2 rotate-45"
                      style={{ background: "var(--w-accent)" }}
                    />
                    <h3
                      style={headingStyle}
                      className="text-3xl font-light sm:text-4xl"
                    >
                      {fn.name}
                    </h3>

                    {whenText && (
                      <p
                        className="mt-3 text-xs uppercase tracking-[0.25em] sm:text-sm"
                        style={{ color: "var(--w-muted)" }}
                      >
                        {whenText}
                      </p>
                    )}

                    {(fn.venueName || fn.address) && (
                      <>
                        <span
                          className="mx-auto my-5 block h-px w-12"
                          style={{ background: "var(--w-primary)", opacity: 0.45 }}
                        />
                        {fn.venueName && (
                          <p
                            style={headingStyle}
                            className="text-xl font-light"
                          >
                            {fn.venueName}
                          </p>
                        )}
                        {fn.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              `${fn.venueName || ""} ${fn.address}`.trim(),
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-sm font-light underline-offset-4 transition hover:underline"
                            style={{ color: "var(--w-muted)" }}
                          >
                            {fn.address}
                          </a>
                        )}
                      </>
                    )}

                    {fn.dressCode && (
                      <p
                        className="mt-4 text-sm font-light italic"
                        style={{ color: "var(--w-accent)" }}
                      >
                        Dress code — {fn.dressCode}
                      </p>
                    )}

                    {fn.notes && (
                      <p
                        className="mx-auto mt-4 max-w-md text-sm font-light italic leading-relaxed"
                        style={{ color: "var(--w-muted)" }}
                      >
                        {fn.notes}
                      </p>
                    )}

                    {/* Function timeline — the running order within this
                        ceremony, as a designed connected timeline. */}
                    {(() => {
                      const items = (
                        Array.isArray((fn as any).timeline)
                          ? ((fn as any).timeline as any[])
                          : []
                      ).filter(
                        (it) => it && (it.time || it.title || it.location),
                      );
                      if (items.length === 0) return null;
                      return (
                        <>
                          <div className="mx-auto mt-7 flex max-w-lg items-center gap-3">
                            <span
                              className="h-px flex-1"
                              style={{ background: "var(--w-primary-border)" }}
                            />
                            <span
                              className="text-[11px] font-semibold uppercase tracking-[0.3em]"
                              style={{ color: "var(--w-primary)" }}
                            >
                              Schedule
                            </span>
                            <span
                              className="h-px flex-1"
                              style={{ background: "var(--w-primary-border)" }}
                            />
                          </div>
                          <FunctionTimeline
                            items={items}
                            fallbackVenue={fn.venueName}
                            layout={theme.functionTimelineLayout}
                          />
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- GALLERY ---------------- */}
      {sec.gallery && gallery.length > 0 && (
        <section
          {...revealAttr}
          className="py-16"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--w-primary-soft))",
          }}
        >
          <div className="mx-auto max-w-5xl px-6">
            <SectionHeading
              icon={<Camera className="h-5 w-5" />}
              label="Moments"
              variant={theme.headingStyle}
              family={sectionFamily}
            />
            <div className="mt-10">
              <GalleryGrid images={gallery} layout={theme.galleryLayout} />
            </div>
          </div>
        </section>
      )}

      {/* ---------------- RSVP / CONTACT ---------------- */}
      <section {...revealAttr} className="py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <SectionHeading
            icon={<Heart className="h-5 w-5" />}
            label="Join Us"
            variant={theme.headingStyle}
              family={sectionFamily}
          />
          <p className="mx-auto mt-6 max-w-md text-lg font-light opacity-90">
            We would be honoured to celebrate this special day with you.
          </p>

          {/* Guest RSVP — Google sign-in then the response form. In demo mode
              the real RSVP is replaced by a register/contact invite. */}
          {isDemo ? (
            <button
              type="button"
              onClick={() => setShowDemoPrompt(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-full px-8 py-3 text-base font-medium text-white shadow-md transition hover:opacity-90"
              style={{ background: "var(--w-primary)" }}
            >
              RSVP
            </button>
          ) : (
            <MarriageRsvp
              eventId={eventData._id}
              functions={functions
                .filter((f) => (f?.name || "").trim())
                .map((f, i) => ({
                  id: f.id || `fn-${i}`,
                  name: f.name,
                  date: f.date,
                  time: f.time,
                  venueName: f.venueName,
                  address: f.address,
                }))}
            />
          )}

          {/* Optional external RSVP/registry link the couple provided. */}
          {inviteLink && (
            <a
              href={inviteLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--w-primary)" }}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              <Heart className="h-4 w-4 fill-current" /> Or visit our wedding
              website
            </a>
          )}

          {sec.contact && hasContact && (
            <div
              className="mx-auto mt-10 max-w-sm p-7 text-left shadow-sm"
              style={{
                background: "var(--w-surface)",
                border: "1px solid var(--w-primary-border)",
                borderRadius: "var(--w-radius)",
              }}
            >
              <p
                className="mb-4 text-center text-xs uppercase tracking-[0.25em]"
                style={{ color: "var(--w-primary)" }}
              >
                Contact
              </p>
              {(marriage.contactName || "").trim() && (
                <p style={headingStyle} className="text-center text-xl">
                  {marriage.contactName}
                </p>
              )}
              <div className="mt-4 space-y-2 text-sm">
                {(marriage.contactPhone || "").trim() && (
                  <a
                    href={`tel:${marriage.contactPhone}`}
                    className="flex items-center justify-center gap-2 transition hover:opacity-70"
                  >
                    <Phone className="h-4 w-4" /> {marriage.contactPhone}
                  </a>
                )}
                {(marriage.contactEmail || "").trim() && (
                  <a
                    href={`mailto:${marriage.contactEmail}`}
                    className="flex items-center justify-center gap-2 transition hover:opacity-70"
                  >
                    <Mail className="h-4 w-4" /> {marriage.contactEmail}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer
        className="py-10 text-center"
        style={{
          background: "var(--w-surface)",
          borderTop: "1px solid var(--w-primary-border)",
        }}
      >
        <Heart
          className="mx-auto mb-3 h-6 w-6 fill-current"
          style={{ color: "var(--w-primary)", opacity: 0.7 }}
        />
        <p style={headingStyle} className="text-2xl font-light">
          {coupleLine.join(" & ")}
        </p>
        {orgName && (
          <p
            className="mt-3 text-xs uppercase tracking-[0.2em]"
            style={{ color: "var(--w-muted)" }}
          >
            Invitation by {orgName}
          </p>
        )}
      </footer>
      </div>
    </div>
  );
}

// --- small presentational helpers ---------------------------------------
// These read the same cascading `--w-*` CSS variables set on the page root,
// so they stay in theme without needing the palette passed down.

// Each design template belongs to a "section family" that carries its look
// down into the below-hero sections — so the whole page feels designed, not
// just the hero. The family decides the decoration drawn under every section
// heading (and, via sectionCardStyle, the card treatment).
export type MarriageSectionFamily = "framed" | "rule" | "botanical" | "modern";
const TEMPLATE_FAMILY: Record<string, MarriageSectionFamily> = {
  atelier: "rule",
  editorial: "rule",
  poster: "rule",
  minimal: "rule",
  cinema: "rule",
  deco: "framed",
  royal: "framed",
  gilded: "framed",
  folio: "framed",
  classic: "botanical",
  boho: "botanical",
  ivory: "botanical",
  vintage: "botanical",
  split: "modern",
  collage: "modern",
  portrait: "modern",
};
export function sectionFamilyFor(template: string): MarriageSectionFamily {
  return TEMPLATE_FAMILY[template] || "botanical";
}

// The decoration drawn under a section heading, matched to the design family.
function SectionDecor({ family }: { family: MarriageSectionFamily }) {
  if (family === "rule") {
    return (
      <span
        className="mt-4 inline-flex items-center gap-2.5"
        style={{ color: "var(--w-primary)" }}
        aria-hidden
      >
        <span className="h-px w-10 sm:w-16" style={{ background: "currentColor", opacity: 0.4 }} />
        <span className="h-1.5 w-1.5 rotate-45" style={{ background: "var(--w-accent)" }} />
        <span className="h-px w-10 sm:w-16" style={{ background: "currentColor", opacity: 0.4 }} />
      </span>
    );
  }
  if (family === "framed") {
    return (
      <span
        className="mt-4 flex flex-col items-center gap-1"
        style={{ color: "var(--w-accent)" }}
        aria-hidden
      >
        <span className="h-px w-24" style={{ background: "currentColor", opacity: 0.7 }} />
        <span className="h-px w-14" style={{ background: "currentColor", opacity: 0.5 }} />
      </span>
    );
  }
  if (family === "modern") {
    return (
      <span
        className="mt-4 block h-1 w-12 rounded-full"
        style={{ background: "var(--w-primary)" }}
        aria-hidden
      />
    );
  }
  // botanical (default) — the hand-drawn leaf flourish.
  return <HeadingFlourish />;
}

function SectionHeading({
  icon,
  label,
  variant = "ornament",
  family = "botanical",
}: {
  icon: React.ReactNode;
  label: string;
  variant?: MarriageHeadingStyle;
  family?: MarriageSectionFamily;
}) {
  const heading = (
    <h2
      style={{ fontFamily: "var(--w-heading-font)" }}
      className="text-3xl font-light tracking-wide sm:text-4xl"
    >
      {label}
    </h2>
  );

  // Minimal: label flanked by delicate rules, with the family decor beneath.
  if (variant === "line") {
    return (
      <div className="flex flex-col items-center">
        <div
          className="flex items-center justify-center gap-4"
          style={{ color: "var(--w-primary)" }}
        >
          <span className="h-px w-12 sm:w-20" style={{ background: "currentColor", opacity: 0.4 }} />
          {heading}
          <span className="h-px w-12 sm:w-20" style={{ background: "currentColor", opacity: 0.4 }} />
        </div>
        <SectionDecor family={family} />
      </div>
    );
  }

  // Icon: a delicate outlined emblem above the label.
  if (variant === "icon") {
    return (
      <div className="flex flex-col items-center">
        <span
          className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border"
          style={{
            borderColor: "var(--w-primary-border)",
            color: "var(--w-primary)",
          }}
        >
          {icon}
        </span>
        {heading}
        <SectionDecor family={family} />
      </div>
    );
  }

  // Ornament (default): family-matched decoration under the label.
  return (
    <div className="flex flex-col items-center">
      {heading}
      <SectionDecor family={family} />
    </div>
  );
}

// A delicate leaf-and-line flourish used under section headings.
function HeadingFlourish() {
  return (
    <span
      className="mt-4 inline-flex items-center gap-2.5"
      style={{ color: "var(--w-primary)" }}
      aria-hidden
    >
      <span
        className="h-px w-8 sm:w-12"
        style={{ background: "currentColor", opacity: 0.45 }}
      />
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <path
          d="M9 1C5 4 3 5.5 3 7s2 3 6 6c4-3 6-4.5 6-6S13 4 9 1z"
          fill="var(--w-primary-soft)"
          stroke="currentColor"
          strokeWidth="0.8"
        />
        <circle cx="9" cy="7" r="1" fill="currentColor" />
      </svg>
      <span
        className="h-px w-8 sm:w-12"
        style={{ background: "currentColor", opacity: 0.45 }}
      />
    </span>
  );
}

// A larger botanical divider (line — leaf — petal — leaf — line). Inherits
// `currentColor`, so callers tint it via `style={{ color: ... }}` (or it
// picks up the hero's white text over a banner).
function Ornament({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={style}
      aria-hidden
    >
      <svg width="200" height="20" viewBox="0 0 200 20" fill="none">
        <path d="M4 10h66" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <path
          d="M130 10h66"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.4"
        />
        <path
          d="M78 10c4-3.2 7.5-3.2 9.5 0-2 3.2-5.5 3.2-9.5 0z"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M122 10c-4-3.2-7.5-3.2-9.5 0 2 3.2 5.5 3.2 9.5 0z"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M100 2c-3.2 4-4.8 6-4.8 8s1.6 4 4.8 8c3.2-4 4.8-6 4.8-8S103.2 6 100 2z"
          fill="var(--w-primary-soft)"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle cx="100" cy="10" r="1.4" fill="currentColor" />
      </svg>
    </div>
  );
}

type StoryMomentView = {
  id?: string;
  image?: string;
  date?: string;
  title?: string;
  content?: string;
};

// Rich-text formatting Tailwind's reset strips from the story body HTML.
const STORY_HTML_CSS = `
  .wedding-story-html p { margin: 0 0 .5rem; }
  .wedding-story-html p:last-child { margin-bottom: 0; }
  .wedding-story-html ul { list-style: disc; padding-left: 1.25rem; margin: .25rem 0; }
  .wedding-story-html ol { list-style: decimal; padding-left: 1.25rem; margin: .25rem 0; }
  .wedding-story-html a { color: var(--w-primary); text-decoration: underline; }
  .wedding-story-html strong { font-weight: 600; }
  .wedding-story-html h2, .wedding-story-html h3 { font-family: var(--w-heading-font); margin: .5rem 0 .25rem; }
`;

// The date / title / body of one story moment — shared by every layout.
function StoryMomentText({ m }: { m: StoryMomentView }) {
  return (
    <>
      {(m.date || "").trim() && (
        <div
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--w-primary)" }}
        >
          {m.date}
        </div>
      )}
      {(m.title || "").trim() && (
        <h3
          style={{ fontFamily: "var(--w-heading-font)" }}
          className="mt-1 text-xl sm:text-2xl"
        >
          {m.title}
        </h3>
      )}
      {(m.content || "").trim() && (
        <div
          className="wedding-story-html mt-3 text-[15px] font-light leading-relaxed opacity-90"
          dangerouslySetInnerHTML={{ __html: m.content }}
        />
      )}
    </>
  );
}

// A ceremony's running order, rendered as an elegant connected timeline:
// time · a node on a continuous vertical spine · what & where. Purely themed
// via the --w-* CSS variables, so it matches whichever design template /
// palette is active. Location falls back to the ceremony venue.
function FunctionTimeline({
  items,
  fallbackVenue,
  layout = "spine",
}: {
  items: {
    id?: string;
    time?: string;
    title?: string;
    location?: string;
  }[];
  fallbackVenue?: string;
  layout?: "spine" | "alternating" | "cards" | "compact";
}) {
  const place = (it: { location?: string }) => it.location || fallbackVenue;

  // COMPACT — a tight single-line-per-step list.
  if (layout === "compact") {
    return (
      <div className="mx-auto mt-6 max-w-lg space-y-2 text-left">
        {items.map((it, i) => (
          <div
            key={it.id || i}
            className="flex flex-wrap items-baseline gap-x-2 text-sm"
          >
            <span
              className="w-[4.5rem] shrink-0 text-right font-semibold tracking-wide"
              style={{ color: "var(--w-primary)" }}
            >
              {prettyTime(it.time) || ""}
            </span>
            <span className="opacity-40">·</span>
            {it.title && <span className="font-medium">{it.title}</span>}
            {place(it) && (
              <span className="text-xs" style={{ color: "var(--w-muted)" }}>
                · {place(it)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // CARDS — a centered stack of small cards, no connecting line.
  if (layout === "cards") {
    return (
      <div className="mx-auto mt-6 flex max-w-md flex-col gap-3">
        {items.map((it, i) => (
          <div
            key={it.id || i}
            className="px-4 py-3 text-center"
            style={{
              background: "var(--w-surface)",
              border: "1px solid var(--w-primary-border)",
              borderRadius: "var(--w-radius)",
            }}
          >
            <span
              className="text-sm font-semibold tracking-wide"
              style={{ color: "var(--w-primary)" }}
            >
              {prettyTime(it.time) || ""}
            </span>
            {it.title && (
              <p className="mt-0.5 text-base font-medium leading-snug">
                {it.title}
              </p>
            )}
            {place(it) && (
              <p className="text-xs" style={{ color: "var(--w-muted)" }}>
                {place(it)}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  // ALTERNATING — cards alternate left/right of a centered line.
  if (layout === "alternating") {
    return (
      <div className="relative mx-auto mt-8 max-w-2xl">
        <div
          className="absolute bottom-0 top-0 left-4 w-px -translate-x-1/2 sm:left-1/2"
          style={{ background: "var(--w-primary)", opacity: 0.3 }}
        />
        <div className="space-y-6">
          {items.map((it, i) => {
            const even = i % 2 === 0;
            return (
              <div key={it.id || i} className="relative">
                <span
                  className="absolute top-1.5 left-4 z-10 h-3 w-3 -translate-x-1/2 rounded-full sm:left-1/2"
                  style={{
                    background: "var(--w-primary)",
                    boxShadow: "0 0 0 4px var(--w-primary-soft)",
                  }}
                />
                <div
                  className={`pl-10 sm:w-1/2 sm:pl-0 ${
                    even
                      ? "sm:pr-10 sm:text-right"
                      : "sm:ml-[50%] sm:pl-10 sm:text-left"
                  }`}
                >
                  <span
                    className="text-sm font-semibold tracking-wide"
                    style={{ color: "var(--w-primary)" }}
                  >
                    {prettyTime(it.time) || ""}
                  </span>
                  {it.title && (
                    <p className="text-base font-medium leading-snug">
                      {it.title}
                    </p>
                  )}
                  {place(it) && (
                    <p className="text-xs" style={{ color: "var(--w-muted)" }}>
                      {place(it)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // SPINE (default) — connected vertical timeline.
  return (
    <div className="mx-auto mt-7 max-w-lg text-left">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <div key={it.id || i} className="relative flex gap-4">
            <div className="w-[4.5rem] shrink-0 pt-0.5 text-right">
              <span
                className="text-sm font-semibold tracking-wide"
                style={{ color: "var(--w-primary)" }}
              >
                {prettyTime(it.time) || ""}
              </span>
            </div>
            <div className="relative flex w-3 flex-col items-center">
              <span
                className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                style={{
                  background: "var(--w-primary)",
                  boxShadow: "0 0 0 4px var(--w-primary-soft)",
                }}
              />
              {!last && (
                <span
                  className="w-px flex-1"
                  style={{ background: "var(--w-primary)", opacity: 0.35 }}
                />
              )}
            </div>
            <div className={`flex-1 ${last ? "pb-0" : "pb-7"}`}>
              {it.title && (
                <p className="text-base font-medium leading-snug">
                  {it.title}
                </p>
              )}
              {place(it) && (
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--w-muted)" }}
                >
                  {place(it)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// "Our Story" moments, arranged per the organizer's chosen template:
//   spine   — alternating cards on a vertical timeline (default)
//   cards   — centered stack of image cards
//   feature — large alternating side-by-side image/text blocks
function StoryTimeline({
  moments,
  layout,
}: {
  moments: StoryMomentView[];
  layout: MarriageStoryLayout;
}) {
  // ── Stacked cards ──
  if (layout === "cards") {
    return (
      <div className="mt-14">
        <style>{STORY_HTML_CSS}</style>
        <div className="mx-auto max-w-xl space-y-10">
          {moments.map((m, i) => (
            <div
              key={m.id || i}
              className="overflow-hidden rounded-2xl text-center"
              style={{
                background: "var(--w-surface)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              }}
            >
              {m.image && (
                <img
                  src={toAbs(m.image)}
                  alt={m.title || "Our story"}
                  className="max-h-80 w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-6 sm:p-8">
                <StoryMomentText m={m} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Feature (large, alternating side-by-side) ──
  if (layout === "feature") {
    return (
      <div className="mt-14">
        <style>{STORY_HTML_CSS}</style>
        <div className="space-y-16 sm:space-y-24">
          {moments.map((m, i) => {
            const left = i % 2 === 0;
            return (
              <div
                key={m.id || i}
                className={`flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10 ${
                  left ? "" : "sm:flex-row-reverse"
                }`}
              >
                {m.image && (
                  <div className="sm:w-3/5">
                    <img
                      src={toAbs(m.image)}
                      alt={m.title || "Our story"}
                      className="max-h-[26rem] w-full rounded-2xl object-cover"
                      style={{ boxShadow: "0 20px 45px rgba(0,0,0,0.12)" }}
                      loading="lazy"
                    />
                  </div>
                )}
                <div className={m.image ? "sm:w-2/5" : "w-full"}>
                  <StoryMomentText m={m} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Timeline / spine (default) ──
  // The line runs down the CENTRE; for each moment the image sits on one side
  // and the text on the other, alternating every row (image-left/text-right,
  // then text-left/image-right, …). On mobile it collapses to a single column
  // with the line on the left.
  return (
    <div className="relative mt-14">
      <style>{STORY_HTML_CSS}</style>
      {/* vertical spine — centre on desktop, left edge on mobile. Position
          lives in classes (not inline) so `sm:left-1/2` can actually centre
          it — an inline `left` would override the class at every breakpoint. */}
      <div
        className="absolute bottom-0 top-0 left-4 w-px -translate-x-1/2 sm:left-1/2"
        style={{ background: "var(--w-primary)", opacity: 0.3 }}
      />
      <div className="space-y-12 sm:space-y-16">
        {moments.map((m, i) => {
          const even = i % 2 === 0;
          const image = m.image ? (
            <div
              className="overflow-hidden rounded-2xl"
              style={{
                background: "var(--w-surface)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              }}
            >
              <img
                src={toAbs(m.image)}
                alt={m.title || "Our story"}
                className="max-h-72 w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null;
          return (
            <div
              key={m.id || i}
              className="relative flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              {/* node dot on the centre line — position via classes so the dot
                  centres on desktop instead of being pinned left by inline CSS */}
              <div
                className="absolute top-1 left-4 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full sm:left-1/2 sm:top-1/2 sm:-translate-y-1/2"
                style={{
                  background: "var(--w-primary)",
                  boxShadow: "0 0 0 4px var(--w-primary-soft)",
                }}
              />
              {/* image column — swaps side each row via flex order */}
              <div
                className={`pl-10 sm:w-1/2 sm:pl-0 ${
                  even ? "sm:order-1 sm:pr-10" : "sm:order-2 sm:pl-10"
                }`}
              >
                {image}
              </div>
              {/* text column — opposite side, aligned toward the line */}
              <div
                className={`pl-10 sm:w-1/2 sm:pl-0 ${
                  even
                    ? "sm:order-2 sm:pl-10 sm:text-left"
                    : "sm:order-1 sm:pr-10 sm:text-right"
                }`}
              >
                <StoryMomentText m={m} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The photo gallery, arranged per the organizer's chosen layout. Every tile
// uses the theme corner radius and a gentle hover zoom. Masonry keeps natural
// photo heights; grid is uniform squares; carousel is a swipeable strip;
// collage features the first photo large within a mosaic.
function GalleryGrid({
  images,
  layout,
}: {
  images: string[];
  layout: MarriageGalleryLayout;
}) {
  const radius = "var(--w-radius)";
  const imgClass =
    "h-full w-full object-cover transition duration-500 hover:scale-105";

  if (layout === "carousel") {
    return <GalleryCarousel images={images} radius={radius} imgClass={imgClass} />;
  }

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {images.map((src, i) => (
          <div
            key={i}
            className="aspect-square overflow-hidden shadow-sm"
            style={{ borderRadius: radius }}
          >
            <img src={src} alt={`Moment ${i + 1}`} loading="lazy" className={imgClass} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "collage") {
    return (
      <div className="grid auto-rows-[120px] grid-cols-2 gap-3 sm:auto-rows-[160px] sm:grid-cols-4 sm:gap-4">
        {images.map((src, i) => {
          // First photo anchors the mosaic; every 7th spans wide for rhythm.
          const span =
            i === 0
              ? "col-span-2 row-span-2"
              : i % 7 === 3
                ? "col-span-2"
                : "";
          return (
            <div
              key={i}
              className={`overflow-hidden shadow-sm ${span}`}
              style={{ borderRadius: radius }}
            >
              <img src={src} alt={`Moment ${i + 1}`} loading="lazy" className={imgClass} />
            </div>
          );
        })}
      </div>
    );
  }

  // masonry (default) — CSS columns preserve each photo's natural height.
  return (
    <div className="columns-2 [column-gap:0.75rem] sm:columns-3 sm:[column-gap:1rem]">
      {images.map((src, i) => (
        <div
          key={i}
          className="mb-3 break-inside-avoid overflow-hidden shadow-sm sm:mb-4"
          style={{ borderRadius: radius }}
        >
          <img
            src={src}
            alt={`Moment ${i + 1}`}
            loading="lazy"
            className="w-full transition duration-500 hover:scale-[1.03]"
          />
        </div>
      ))}
    </div>
  );
}

// Auto-advancing photo carousel: scrolls to the next photo every 3 seconds
// (still fully swipeable). Pauses while the guest is hovering or touching it,
// and loops back to the first photo at the end.
function GalleryCarousel({
  images,
  radius,
  imgClass,
}: {
  images: string[];
  radius: string;
  imgClass: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      const el = scrollRef.current;
      if (!el || pausedRef.current) return;
      indexRef.current = (indexRef.current + 1) % images.length;
      const child = el.children[indexRef.current] as HTMLElement | undefined;
      if (!child) return;
      // Centre the next tile (matches snap-center) without scrolling the page —
      // the container is `relative`, so offsetLeft is measured from it.
      const target = Math.max(
        0,
        Math.min(
          child.offsetLeft - (el.clientWidth - child.clientWidth) / 2,
          el.scrollWidth - el.clientWidth,
        ),
      );
      el.scrollTo({ left: target, behavior: "smooth" });
    }, 3000);
    return () => clearInterval(id);
  }, [images.length]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div
      ref={scrollRef}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto sm:gap-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {images.map((src, i) => (
        <div
          key={i}
          className="aspect-[4/3] w-[80%] shrink-0 snap-center overflow-hidden shadow-sm sm:w-[46%]"
          style={{ borderRadius: radius }}
        >
          <img src={src} alt={`Moment ${i + 1}`} loading="lazy" className={imgClass} />
        </div>
      ))}
    </div>
  );
}

// Inject the fade-up keyframes once (client only). Elements tagged with
// `data-wed-reveal` gently rise into place on load — added by the page when
// the theme's Animations toggle is on.
if (
  typeof document !== "undefined" &&
  !document.getElementById("marriage-eventfront-anim")
) {
  const s = document.createElement("style");
  s.id = "marriage-eventfront-anim";
  s.textContent = [
    // Section fade-up on load / scroll.
    "@keyframes wedReveal{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}",
    "[data-wed-reveal]{animation:wedReveal .9s cubic-bezier(.2,.7,.2,1) both}",
    // Ken Burns — a slow, breathing zoom on the hero photo.
    "@keyframes wedKen{from{transform:scale(1)}to{transform:scale(1.12)}}",
    "[data-wed-anim] .wed-kb{animation:wedKen 22s ease-in-out infinite alternate}",
    // Falling petals — drift down while swaying + rotating.
    "@keyframes wedPetal{0%{transform:translateY(-10vh) translateX(0) rotate(0deg);opacity:0}12%{opacity:var(--po,.8)}86%{opacity:var(--po,.8)}100%{transform:translateY(112vh) translateX(var(--pd,40px)) rotate(420deg);opacity:0}}",
    ".wed-petal{position:absolute;top:0;will-change:transform,opacity;animation:wedPetal var(--pdur,12s) linear var(--pdel,0s) infinite}",
    // Respect users who prefer no motion.
    "@media (prefers-reduced-motion: reduce){.wed-petal{display:none}[data-wed-anim] .wed-kb{animation:none}[data-wed-reveal]{animation:none}}",
  ].join("");
  document.head.appendChild(s);
}
