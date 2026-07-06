// An ornate couple-initials monogram seal, styled after Indian wedding-card
// medallions. Three selectable treatments (Design tab → "Monogram style"):
//   mandala — petals + beaded gold ring + paisleys (the full seal)
//   ring    — clean beaded double ring
//   minimal — initials with a delicate flourish, no enclosure
// Drawn with `currentColor` (so it reads white over a hero photo, or the
// theme text color elsewhere) plus `--w-accent` gold highlights, with the
// initials in the theme heading font. Shared by the public Eventfront and the
// form's live preview so both look identical.

import type { MarriageMonogramStyle } from "@/lib/marriageThemes";

const PETALS = Array.from({ length: 24 });
const BEADS = Array.from({ length: 36 });

// A small gold paisley/teardrop, used at cardinal points.
function Paisley({ angle }: { angle: number }) {
  return (
    <g transform={`rotate(${angle} 60 60)`}>
      <path
        d="M60 1.5c-3 2.6-3.9 4.7-2.3 6.7 1.2 1.5 3.4 1.5 4.6 0 1.6-2 0.7-4.1-2.3-6.7z"
        fill="var(--w-accent)"
        opacity="0.9"
      />
    </g>
  );
}

function beadRing(radius: number) {
  return BEADS.map((_, i) => {
    const rad = ((360 / BEADS.length) * i * Math.PI) / 180;
    const x = 60 + radius * Math.sin(rad);
    const y = 60 - radius * Math.cos(rad);
    return <circle key={`b${i}`} cx={x} cy={y} r="1" fill="var(--w-accent)" />;
  });
}

export function MarriageMonogram({
  left,
  right,
  variant = "mandala",
  size = 116,
  className = "",
}: {
  left: string;
  right: string;
  variant?: MarriageMonogramStyle;
  size?: number;
  className?: string;
}) {
  const l = (left || "").trim().charAt(0).toUpperCase();
  const r = (right || "").trim().charAt(0).toUpperCase();
  if (!l && !r) return null;

  const fs = variant === "minimal" ? 32 : 26;
  const ampFs = variant === "minimal" ? 19 : 16;

  const initials = (
    <text
      x="60"
      y="61"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontFamily: "var(--w-heading-font)" }}
      fontSize={fs}
      fontWeight="500"
      fill="currentColor"
    >
      <tspan>{l}</tspan>
      {r && (
        <>
          <tspan fill="var(--w-accent)" fontSize={ampFs}>
            {" "}
            &amp;{" "}
          </tspan>
          <tspan>{r}</tspan>
        </>
      )}
    </text>
  );

  return (
    <div className={`flex justify-center ${className}`} aria-hidden>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        style={{ color: "currentColor" }}
      >
        {variant === "mandala" && (
          <>
            {PETALS.map((_, i) => {
              const a = (360 / PETALS.length) * i;
              return (
                <ellipse
                  key={`p${i}`}
                  cx="60"
                  cy="13"
                  rx="2.3"
                  ry="6.2"
                  transform={`rotate(${a} 60 60)`}
                  stroke="currentColor"
                  strokeWidth="0.7"
                  opacity="0.8"
                />
              );
            })}
            <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
            {beadRing(38)}
            <circle cx="60" cy="60" r="31" stroke="currentColor" strokeWidth="1" opacity="0.8" />
            <circle cx="60" cy="60" r="27.5" stroke="var(--w-accent)" strokeWidth="0.6" opacity="0.7" />
            {[0, 90, 180, 270].map((a) => (
              <Paisley key={a} angle={a} />
            ))}
          </>
        )}

        {variant === "ring" && (
          <>
            <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
            {beadRing(42)}
            <circle cx="60" cy="60" r="33" stroke="currentColor" strokeWidth="1" opacity="0.8" />
            <circle cx="60" cy="60" r="29" stroke="var(--w-accent)" strokeWidth="0.6" opacity="0.65" />
            {[0, 90, 180, 270].map((a) => {
              const rad = (a * Math.PI) / 180;
              const x = 60 + 48 * Math.sin(rad);
              const y = 60 - 48 * Math.cos(rad);
              return (
                <rect
                  key={a}
                  x={x - 2}
                  y={y - 2}
                  width="4"
                  height="4"
                  transform={`rotate(45 ${x} ${y})`}
                  fill="var(--w-accent)"
                />
              );
            })}
          </>
        )}

        {variant === "minimal" && (
          <g transform="translate(60 90)" style={{ color: "currentColor" }}>
            <line x1="-24" y1="0" x2="-7" y2="0" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
            <path
              d="M0 -5C-2.6 -2 -3.4 -0.5 -2 1 -1 2 1 2 2 1c1.4 -1.5 0.6 -3 -2 -6z"
              fill="var(--w-accent)"
            />
            <line x1="7" y1="0" x2="24" y2="0" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
          </g>
        )}

        {initials}
      </svg>
    </div>
  );
}

export default MarriageMonogram;
