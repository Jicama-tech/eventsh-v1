import React from "react";
import { Sparkles } from "lucide-react";

interface AnnouncementBarProps {
  message?: string;
  backgroundColor?: string;
  textColor?: string;
  speed?: string;
  fontFamily?: string;
}

// Sticky marquee strip rendered at the top of the eventfront.
// Ported from the kioscart-v1 storefront's adBar so events get the
// same look-and-feel announcement bar. Kept simple for now (no
// floating / dismissible variants) — the form only exposes message
// + colors so far; advanced positioning can be layered on later
// without touching this component's external shape.
const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  message = "",
  backgroundColor = "#000000",
  textColor = "#ffffff",
  speed = "40s",
  fontFamily = "inherit",
}) => {
  if (!message) return null;

  return (
    <div
      // Renders in normal document flow at the top of the eventfront,
      // sitting above the sticky header + the event banner. We don't
      // make this sticky itself because the eventfront's <header> is
      // already sticky at top-0 z-50 — two sticky strips at top-0
      // would overlap (the header would hide the bar). On scroll the
      // bar leaves the viewport and the header stays pinned, matching
      // the kioscart storefront layout where the bar is a one-time
      // announcement rather than a persistent strip.
      className="w-full overflow-hidden relative"
      style={{ backgroundColor }}
    >
      <div className="py-2 sm:py-2.5">
        <div
          className="flex animate-event-ad-marquee hover:[animation-play-state:paused]"
          style={{ "--event-ad-speed": speed } as React.CSSProperties}
        >
          {/* The message is repeated 8x in the DOM so translating
              -50% lands the second copy seamlessly where the first
              started — the standard CSS-only infinite-marquee trick. */}
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className="flex items-center gap-2 sm:gap-3 whitespace-nowrap px-4 sm:px-6 md:px-8"
              style={{ color: textColor, fontFamily }}
            >
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 opacity-70" />
              <span className="text-[11px] sm:text-xs md:text-sm font-semibold tracking-wide sm:tracking-wider uppercase">
                {message}
              </span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes event-ad-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-event-ad-marquee {
          display: flex;
          width: max-content;
          animation: event-ad-marquee var(--event-ad-speed, 40s) linear infinite;
        }
      `}</style>
    </div>
  );
};

export default AnnouncementBar;
