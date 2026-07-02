import React from "react";

interface SponsorMarqueeProps {
  /** Already-resolved logo image URLs (caller handles /uploads + blob: paths). */
  logos: string[];
  /** CSS animation duration, e.g. "40s". Defaults to scale with logo count. */
  speed?: string;
  backgroundColor?: string;
  className?: string;
}

// Sponsor logo marquee — mirrors the AnnouncementBar (ad bar) style: a
// full-width, overflow-hidden bar with a hover-pausable CSS marquee. Unlike the
// ad bar (which scrolls right-to-left) this moves LEFT-TO-RIGHT and shows logos
// instead of text. The track is duplicated once for a seamless loop; a pure CSS
// transform + lazy-loaded images keeps it light.
const SponsorMarquee: React.FC<SponsorMarqueeProps> = ({
  logos,
  speed,
  backgroundColor = "#ffffff",
  className = "",
}) => {
  if (!logos || logos.length === 0) return null;
  // Repeat the logos so ONE copy comfortably exceeds the viewport width —
  // otherwise a short list leaves a blank gap that reads as a mid-way reset.
  // That repeated set is then duplicated once for the seamless -50% loop.
  const base: string[] = [];
  while (base.length < 15) base.push(...logos);
  const track = [...base, ...base];
  // Duration scales with the REPEATED track length (not the raw logo count) so
  // the on-screen pixel speed stays comfortable however many logos there are.
  const dur = speed || `${Math.max(28, base.length * 2.2)}s`;
  return (
    <div
      className={`w-full overflow-hidden ${className}`}
      style={{ backgroundColor }}
    >
      <div
        className="sponsor-marquee-track flex w-max items-center hover:[animation-play-state:paused]"
        style={{ "--sp-speed": dur } as React.CSSProperties}
      >
        {/* Spacing lives on each logo (margin-right), NOT flex `gap`, so the two
            duplicated halves line up exactly and the -50% loop is seamless
            (no mid-way jump/reset). */}
        {track.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="Sponsor"
            loading="lazy"
            className="mr-10 h-14 w-auto shrink-0 object-contain sm:mr-16 sm:h-20"
          />
        ))}
      </div>
      <style>{`
        @keyframes sponsorMarqueeLtr {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .sponsor-marquee-track {
          animation: sponsorMarqueeLtr var(--sp-speed, 40s) linear infinite;
          will-change: transform;
        }
      `}</style>
    </div>
  );
};

export default SponsorMarquee;
