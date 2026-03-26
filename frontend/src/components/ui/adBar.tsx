import React from "react";

interface AnnouncementBarProps {
  message?: string;
  backgroundColor?: string;
  textColor?: string;
  speed?: string;
  fontFamily?: string;
}

const AnnouncementBar: React.FC<AnnouncementBarProps> = ({
  message = "✨ Special Offer: Get 20% off on all new arrivals! Use code: WELCOME20 ✨",
  backgroundColor = "#000000",
  textColor = "#ffffff",
  speed = "50s",
  fontFamily = "Poppins",
}) => {
  return (
    <div
      className="w-full overflow-hidden py-1.5 sm:py-2 md:py-2.5 relative position-sticky top-0 z-[1]"
      style={{ backgroundColor }}
    >
      {/* Pass --speed as inline style to the animated element */}
      <div
        className="flex animate-marquee hover:[animation-play-state:paused]"
        style={{ "--speed": speed } as React.CSSProperties}
      >
        <span
          className="text-xs sm:text-sm md:text-base font-semibold px-3 sm:px-4 md:px-6 uppercase tracking-wide md:tracking-widest whitespace-nowrap"
          style={{ color: textColor, fontFamily: fontFamily }}
        >
          {message}
        </span>
        <span
          className="text-xs sm:text-sm md:text-base font-semibold px-3 sm:px-4 md:px-6 uppercase tracking-wide md:tracking-widest [margin-right:calc(var(--gap)*1.5)] whitespace-nowrap"
          style={{ color: textColor }}
        >
          {message}
        </span>
        <span
          className="text-xs sm:text-sm md:text-base font-semibold px-3 sm:px-4 md:px-6 uppercase tracking-wide md:tracking-widest [margin-right:calc(var(--gap)*1.5)] whitespace-nowrap"
          style={{ color: textColor }}
        >
          {message}
        </span>
        <span
          className="text-xs sm:text-sm md:text-base font-semibold px-3 sm:px-4 md:px-6 uppercase tracking-wide md:tracking-widest [margin-right:calc(var(--gap)*1.5)] whitespace-nowrap"
          style={{ color: textColor }}
        >
          {message}
        </span>
        <span
          className="text-xs sm:hidden px-3 uppercase tracking-wide [margin-right:calc(var(--gap)*1.5)] whitespace-nowrap"
          style={{ color: textColor }}
        >
          {message}
        </span>
        <span
          className="text-xs sm:text-sm md:text-base font-semibold px-3 sm:px-4 md:px-6 uppercase tracking-wide md:tracking-widest [margin-right:calc(var(--gap)*1.5)] whitespace-nowrap"
          style={{ color: textColor }}
        >
          {message}
        </span>
        <span
          className="text-xs sm:text-sm md:text-base font-semibold px-3 sm:px-4 md:px-6 uppercase tracking-wide md:tracking-widest [margin-right:calc(var(--gap)*1.5)] whitespace-nowrap"
          style={{ color: textColor }}
        >
          {message}
        </span>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          --gap: 2rem;
          animation: marquee var(--speed, 40s) linear infinite;
        }
        @media (max-width: 640px) {
          .animate-marquee {
            --gap: 1rem;
            animation: marquee var(--speed, 40s) linear infinite;
          }
        }
        @media (max-width: 425px) {
            .animate-marquee {
                --gap: 0.5rem;
                animation: marquee var(--speed, 30s) linear infinite;
            }
        }
      `}</style>
    </div>
  );
};

export default AnnouncementBar;
