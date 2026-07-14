// A decorative top emblem for the wedding hero — Indian wedding-card motifs:
// a devotional Ganesha or Om, or non-religious florals (lotus, kalash,
// floral spray). Drawn as delicate line art with `currentColor` (white over a
// hero photo, theme text colour otherwise) and `--w-accent` gold highlights,
// so each motif always matches the chosen palette. Shared by the public
// Eventfront and the form's live preview.

import type { MarriageTopMotif } from "@/lib/marriageThemes";

// A small line — leaf — line flourish placed beneath every motif.
function Flourish() {
  return (
    <g transform="translate(50 74)">
      <line x1="-18" y1="0" x2="-4" y2="0" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <path
        d="M0 -4c-2 2.4-2.6 3.6-1.6 4.8 0.8 0.8 2.4 0.8 3.2 0 1.1-1.2 0.5-2.4-1.6-4.8z"
        fill="var(--w-accent)"
      />
      <line x1="4" y1="0" x2="18" y2="0" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
    </g>
  );
}

export function MarriageMotif({
  variant,
  size = 96,
  className = "",
}: {
  variant: MarriageTopMotif;
  size?: number;
  className?: string;
}) {
  if (variant === "none") return null;

  let content: React.ReactNode = null;

  if (variant === "om") {
    content = (
      <>
        <text
          x="50"
          y="40"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="46"
          fill="currentColor"
          style={{ fontFamily: "Georgia, 'Segoe UI', 'Noto Serif', serif" }}
        >
          {"ॐ"}
        </text>
        <Flourish />
      </>
    );
  } else if (variant === "lotus") {
    content = (
      <>
        {[-52, -26, 0, 26, 52].map((a) => (
          <path
            key={a}
            d="M50 56 C 43 40 47 26 50 22 C 53 26 57 40 50 56 Z"
            transform={`rotate(${a} 50 58)`}
            stroke="currentColor"
            strokeWidth="0.8"
            fill="var(--w-primary-soft)"
          />
        ))}
        <path d="M34 58 Q 50 66 66 58" stroke="currentColor" strokeWidth="0.9" fill="none" />
        <circle cx="50" cy="58" r="2" fill="var(--w-accent)" />
        <Flourish />
      </>
    );
  } else if (variant === "kalash") {
    content = (
      <>
        {/* mango leaves */}
        <path d="M50 46 C 38 44 32 34 35 27 C 42 30 48 38 50 46 Z" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.7" />
        <path d="M50 46 C 62 44 68 34 65 27 C 58 30 52 38 50 46 Z" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.7" />
        <path d="M50 44 C 47 34 50 26 50 22 C 50 26 53 34 50 44 Z" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.7" />
        {/* coconut */}
        <circle cx="50" cy="46" r="6" fill="var(--w-accent-soft)" stroke="currentColor" strokeWidth="0.8" />
        {/* rim + pot */}
        <ellipse cx="50" cy="54" rx="13" ry="2.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
        <path d="M39 55 C 33 64 39 74 50 74 C 61 74 67 64 61 55 Z" stroke="currentColor" strokeWidth="0.9" fill="var(--w-primary-soft)" />
        <path d="M41 64 Q 50 67 59 64" stroke="var(--w-accent)" strokeWidth="0.8" fill="none" />
      </>
    );
  } else if (variant === "rings") {
    // Two interlocking wedding bands.
    content = (
      <>
        <circle cx="43" cy="40" r="14" stroke="var(--w-accent)" strokeWidth="1.6" fill="none" />
        <circle cx="57" cy="40" r="14" stroke="currentColor" strokeWidth="1.4" fill="none" opacity="0.85" />
        {/* little sparkle on the left band */}
        <path
          d="M43 24 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4z"
          fill="var(--w-accent)"
        />
        <Flourish />
      </>
    );
  } else if (variant === "dove") {
    // A gentle line-art dove in flight.
    content = (
      <>
        <g stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 46 C 36 34 48 30 60 32 C 66 33 70 36 74 40" fill="var(--w-primary-soft)" />
          <path d="M60 32 C 64 26 70 24 76 24 C 72 28 70 32 68 36" fill="var(--w-primary-soft)" />
          <path d="M34 44 C 30 40 26 40 22 42 C 26 44 29 46 32 47" fill="var(--w-primary-soft)" />
          <path d="M28 46 C 34 50 44 52 52 50" />
          <path d="M52 50 L 60 56 M 56 50 L 62 58" />
        </g>
        <circle cx="72" cy="37" r="1.2" fill="var(--w-accent)" />
        <Flourish />
      </>
    );
  } else if (variant === "wreath") {
    // A laurel / floral wreath circling a small heart.
    content = (
      <>
        <path d="M50 20 C 30 24 24 44 34 58" stroke="currentColor" strokeWidth="1" fill="none" />
        <path d="M50 20 C 70 24 76 44 66 58" stroke="currentColor" strokeWidth="1" fill="none" />
        {[26, 34, 42, 50].map((y, i) => (
          <g key={`l${i}`}>
            <ellipse
              cx={i < 2 ? 30 - i * 1 : 34 - i}
              cy={y}
              rx="4"
              ry="2"
              transform={`rotate(${-40 + i * 6} ${i < 2 ? 30 : 34} ${y})`}
              fill="var(--w-primary-soft)"
              stroke="currentColor"
              strokeWidth="0.5"
            />
            <ellipse
              cx={i < 2 ? 70 + i * 1 : 66 + i}
              cy={y}
              rx="4"
              ry="2"
              transform={`rotate(${40 - i * 6} ${i < 2 ? 70 : 66} ${y})`}
              fill="var(--w-primary-soft)"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </g>
        ))}
        <path
          d="M50 52 c -3 -3.6 -3.9 -5.4 -2.4 -7.2 1.2 -1.2 3.6 -1.2 4.8 0 1.5 -1.2 3.6 -1.2 4.8 0 1.5 1.8 0.6 3.6 -2.4 7.2z"
          fill="var(--w-accent-soft)"
          stroke="var(--w-accent)"
          strokeWidth="0.7"
        />
        <Flourish />
      </>
    );
  } else if (variant === "crest") {
    // A heraldic crest / shield frame (monogram-ready).
    content = (
      <>
        <path
          d="M50 16 L 68 22 V 40 C 68 54 60 62 50 68 C 40 62 32 54 32 40 V 22 Z"
          fill="var(--w-primary-soft)"
          stroke="currentColor"
          strokeWidth="1.1"
        />
        <path d="M38 27 H 62" stroke="var(--w-accent)" strokeWidth="0.8" />
        <path d="M40 58 C 45 61 55 61 60 58" stroke="var(--w-accent)" strokeWidth="0.8" fill="none" />
        {/* little laurel sprigs at the base */}
        <path d="M50 45 C 46 41 46 35 50 31 C 54 35 54 41 50 45 Z" fill="var(--w-accent-soft)" stroke="var(--w-accent)" strokeWidth="0.6" />
        <circle cx="50" cy="22" r="1.4" fill="var(--w-accent)" />
        <Flourish />
      </>
    );
  } else if (variant === "floral") {
    content = (
      <>
        {/* center flower */}
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse
            key={a}
            cx="50"
            cy="31"
            rx="3"
            ry="8"
            transform={`rotate(${a} 50 40)`}
            stroke="currentColor"
            strokeWidth="0.8"
            fill="var(--w-primary-soft)"
          />
        ))}
        <circle cx="50" cy="40" r="2.6" fill="var(--w-accent)" />
        {/* right spray */}
        <path d="M56 42 C 70 44 80 38 90 28" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.75" />
        <ellipse cx="68" cy="44" rx="4" ry="2" transform="rotate(20 68 44)" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.6" />
        <ellipse cx="80" cy="36" rx="4" ry="2" transform="rotate(-20 80 36)" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="90" cy="28" r="2.4" fill="var(--w-accent)" />
        {/* left spray (mirrored) */}
        <path d="M44 42 C 30 44 20 38 10 28" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.75" />
        <ellipse cx="32" cy="44" rx="4" ry="2" transform="rotate(-20 32 44)" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.6" />
        <ellipse cx="20" cy="36" rx="4" ry="2" transform="rotate(20 20 36)" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="10" cy="28" r="2.4" fill="var(--w-accent)" />
      </>
    );
  } else {
    // ganesha — stylized line-art (crown, ears, trunk), scaled up for clarity.
    content = (
      <>
        <g
          transform="translate(50 35) scale(1.22) translate(-50 -35)"
          stroke="currentColor"
          fill="none"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* crown finial + dome */}
          <circle cx="50" cy="6" r="1.7" fill="var(--w-accent)" stroke="none" />
          <path d="M43 23 C 43 12 47 7 50 7 C 53 7 57 12 57 23" fill="var(--w-primary-soft)" />
          <path d="M41 23 H 59" />
          {/* head top + face */}
          <path d="M40 25 C 44 20 56 20 60 25" />
          <path d="M38 27 C 35 44 43 52 50 52 C 57 52 65 44 62 27" fill="var(--w-primary-soft)" />
          {/* ears */}
          <path d="M38 27 C 23 22 19 42 33 44 C 35 38 37 32 38 27 Z" fill="var(--w-primary-soft)" />
          <path d="M62 27 C 77 22 81 42 67 44 C 65 38 63 32 62 27 Z" fill="var(--w-primary-soft)" />
          {/* eyes */}
          <path d="M41 34 C 43 32 46 32 48 34" />
          <path d="M52 34 C 54 32 57 32 59 34" />
          {/* tilak */}
          <path d="M50 25 v 5" stroke="var(--w-accent)" />
          {/* trunk curling to the left */}
          <path d="M50 36 C 50 47 47 55 41 56 C 36.5 56.5 35.5 51.5 39 49" />
          {/* tusks */}
          <path d="M46 51 L 43.5 55" />
          <path d="M55 50 L 57.5 54" />
        </g>
        <Flourish />
      </>
    );
  }

  return (
    <div className={`flex justify-center ${className}`} aria-hidden>
      <svg
        width={size}
        height={Math.round(size * 0.84)}
        viewBox="0 0 100 84"
        fill="none"
        style={{ color: "currentColor" }}
      >
        {content}
      </svg>
    </div>
  );
}

export default MarriageMotif;
