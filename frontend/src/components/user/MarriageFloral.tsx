// Botanical corner decoration for the wedding hero — drawn anchored at the
// top-left and flipped into the other corners. Several distinct STYLES are
// offered (a stationery house would too): botanical spray, eucalyptus,
// roses, wildflowers, tropical leaves, trailing vine. All are tinted with the
// theme's primary (stems/leaves via currentColor) and accent (flowers), at low
// opacity so they frame without competing with the names/photo.

import type { MarriageFloralStyle } from "@/lib/marriageThemes";

function Leaf({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path
        d="M0 0 C -3.5 -5 -3.5 -12 0 -17 C 3.5 -12 3.5 -5 0 0 Z"
        fill="var(--w-primary-soft)"
        stroke="currentColor"
        strokeWidth="0.7"
      />
      <path
        d="M0 -1.5 L 0 -15"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.7"
      />
    </g>
  );
}

function Blossom({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-5"
          rx="2.4"
          ry="5"
          transform={`rotate(${a})`}
          fill="var(--w-accent-soft)"
          stroke="var(--w-accent)"
          strokeWidth="0.6"
        />
      ))}
      <circle r="1.8" fill="var(--w-accent)" />
    </g>
  );
}

// A rounded (eucalyptus / silver-dollar) leaf.
function RoundLeaf({
  x,
  y,
  r,
  s = 1,
}: {
  x: number;
  y: number;
  r: number;
  s?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <circle
        r="6"
        fill="var(--w-primary-soft)"
        stroke="currentColor"
        strokeWidth="0.7"
      />
    </g>
  );
}

// A small open rose (spiralled petals).
function Rose({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r="7" fill="var(--w-accent-soft)" stroke="var(--w-accent)" strokeWidth="0.7" />
      <path
        d="M0 4 C -4 4 -5 -1 -2 -3 C 0 -5 4 -4 4 -1 C 4 2 1 3 -1 1 C -2 0 -1 -2 1 -2"
        fill="none"
        stroke="var(--w-accent)"
        strokeWidth="0.7"
      />
    </g>
  );
}

// A daisy-like wildflower.
function Daisy({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 51, 102, 153, 204, 255, 306].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-5.5"
          rx="1.5"
          ry="4.5"
          transform={`rotate(${a})`}
          fill="var(--w-accent-soft)"
          stroke="var(--w-accent)"
          strokeWidth="0.5"
        />
      ))}
      <circle r="2" fill="var(--w-accent)" />
    </g>
  );
}

function StylePaths({ style }: { style: MarriageFloralStyle }) {
  if (style === "eucalyptus") {
    // A single curving stem lined with round paired leaves.
    const stem = "M4 4 C 38 26 58 60 64 112";
    const leaves: { x: number; y: number; r: number; s?: number }[] = [
      { x: 16, y: 16, r: -40 },
      { x: 26, y: 22, r: 60 },
      { x: 30, y: 40, r: -50 },
      { x: 42, y: 48, r: 55 },
      { x: 44, y: 70, r: -55 },
      { x: 58, y: 78, r: 50 },
      { x: 56, y: 100, r: -60 },
    ];
    return (
      <>
        <path d={stem} stroke="currentColor" strokeWidth="1.1" opacity="0.6" fill="none" />
        {leaves.map((l, i) => (
          <RoundLeaf key={i} {...l} />
        ))}
      </>
    );
  }
  if (style === "roses") {
    return (
      <>
        <path d="M6 6 C 30 26 46 54 52 96" stroke="currentColor" strokeWidth="1.1" opacity="0.6" fill="none" />
        <path d="M14 10 C 34 18 50 30 64 44" stroke="currentColor" strokeWidth="1" opacity="0.5" fill="none" />
        <Leaf x={30} y={40} r={40} />
        <Leaf x={44} y={66} r={-14} />
        <Rose x={16} y={16} s={0.9} />
        <Rose x={54} y={94} s={1.1} />
        <Rose x={66} y={44} s={0.75} />
      </>
    );
  }
  if (style === "wildflower") {
    return (
      <>
        {/* fanning thin stems */}
        <path d="M8 8 C 24 34 34 62 40 104" stroke="currentColor" strokeWidth="0.9" opacity="0.6" fill="none" />
        <path d="M8 8 C 34 26 56 40 78 52" stroke="currentColor" strokeWidth="0.9" opacity="0.6" fill="none" />
        <path d="M8 8 C 20 20 30 30 44 40" stroke="currentColor" strokeWidth="0.8" opacity="0.5" fill="none" />
        <Leaf x={26} y={52} r={20} />
        <Leaf x={52} y={34} r={-40} />
        <Daisy x={40} y={106} s={1} />
        <Daisy x={80} y={52} s={0.85} />
        <Daisy x={44} y={40} s={0.7} />
      </>
    );
  }
  if (style === "tropical") {
    // A monstera-style split leaf plus a palm frond.
    return (
      <>
        <path d="M4 4 C 30 20 42 44 46 78" stroke="currentColor" strokeWidth="1" opacity="0.55" fill="none" />
        <g transform="translate(30 34) rotate(18)">
          <path
            d="M0 0 C -20 -6 -28 -26 -22 -46 C -10 -40 2 -44 12 -50 C 10 -32 18 -18 12 -4 C 8 -2 4 -1 0 0 Z"
            fill="var(--w-primary-soft)"
            stroke="currentColor"
            strokeWidth="0.8"
          />
          {/* slits */}
          <path d="M-16 -40 L -6 -34" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <path d="M-18 -28 L -8 -24" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
          <path d="M-16 -16 L -6 -14" stroke="currentColor" strokeWidth="0.6" opacity="0.7" />
        </g>
        {/* palm frond */}
        <g transform="translate(58 60) rotate(30)">
          <path d="M0 0 L -34 -34" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
          {[6, 12, 18, 24, 30].map((d) => (
            <path
              key={d}
              d={`M ${-d} ${-d} l -9 3 M ${-d} ${-d} l 3 -9`}
              stroke="currentColor"
              strokeWidth="0.6"
              opacity="0.6"
            />
          ))}
        </g>
      </>
    );
  }
  if (style === "vine") {
    // A delicate trailing vine: wavy stem with alternating tiny leaves + buds.
    const stem = "M4 4 C 26 18 10 38 30 52 C 50 66 30 86 52 104";
    return (
      <>
        <path d={stem} stroke="currentColor" strokeWidth="1" opacity="0.6" fill="none" />
        {[
          { x: 18, y: 20, r: -30 },
          { x: 16, y: 34, r: 40 },
          { x: 32, y: 48, r: -20 },
          { x: 34, y: 64, r: 50 },
          { x: 44, y: 80, r: -25 },
          { x: 46, y: 96, r: 45 },
        ].map((l, i) => (
          <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.r})`}>
            <path
              d="M0 0 C -2.5 -3.5 -2.5 -8 0 -11 C 2.5 -8 2.5 -3.5 0 0 Z"
              fill="var(--w-primary-soft)"
              stroke="currentColor"
              strokeWidth="0.6"
            />
          </g>
        ))}
        <circle cx="24" cy="26" r="1.6" fill="var(--w-accent)" />
        <circle cx="40" cy="72" r="1.6" fill="var(--w-accent)" />
        <circle cx="52" cy="102" r="1.8" fill="var(--w-accent)" />
      </>
    );
  }
  if (style === "peony") {
    // A full, ruffled peony bloom with leaves — lush and romantic.
    return (
      <>
        <path d="M6 6 C 26 26 40 52 46 94" stroke="currentColor" strokeWidth="1" opacity="0.5" fill="none" />
        <Leaf x={36} y={56} r={28} />
        <Leaf x={50} y={82} r={-10} />
        <g transform="translate(30 30)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <ellipse
              key={`o${a}`}
              cx="0"
              cy="-14"
              rx="6"
              ry="9"
              transform={`rotate(${a})`}
              fill="var(--w-primary-soft)"
              stroke="currentColor"
              strokeWidth="0.6"
            />
          ))}
          {[22, 67, 112, 157, 202, 247, 292, 337].map((a) => (
            <ellipse
              key={`i${a}`}
              cx="0"
              cy="-8"
              rx="4.5"
              ry="6.5"
              transform={`rotate(${a})`}
              fill="var(--w-accent-soft)"
              stroke="var(--w-accent)"
              strokeWidth="0.5"
            />
          ))}
          <circle r="4" fill="var(--w-accent)" />
        </g>
      </>
    );
  }
  if (style === "lavender") {
    // Slender lavender / thistle sprigs — tall columns of little buds.
    const stems = [
      { x: 14, rot: -14 },
      { x: 26, rot: -3 },
      { x: 38, rot: 8 },
    ];
    return (
      <>
        {stems.map((s, i) => (
          <g key={i} transform={`translate(${s.x} 8) rotate(${s.rot})`}>
            <path d="M0 0 C 2 30 4 60 6 98" stroke="currentColor" strokeWidth="0.9" opacity="0.55" fill="none" />
            {[8, 15, 22, 29, 36, 43, 50].map((y, j) => (
              <ellipse
                key={j}
                cx={2 + (j % 2 ? 1 : -1) * 2.4}
                cy={y}
                rx="2.3"
                ry="3.8"
                transform={`rotate(${j % 2 ? 20 : -20} 2 ${y})`}
                fill="var(--w-accent-soft)"
                stroke="var(--w-accent)"
                strokeWidth="0.4"
              />
            ))}
          </g>
        ))}
      </>
    );
  }
  if (style === "babysbreath") {
    // Airy baby's breath — thin stems ending in clusters of tiny blooms.
    const stems = [
      "M8 8 C 24 30 34 58 40 100",
      "M8 8 C 32 24 56 40 82 52",
      "M8 8 C 20 20 30 34 46 44",
    ];
    const clusters: [number, number][] = [
      [40, 100],
      [82, 52],
      [46, 44],
      [30, 70],
      [60, 86],
      [66, 40],
    ];
    return (
      <>
        {stems.map((d, i) => (
          <path key={i} d={d} stroke="currentColor" strokeWidth="0.7" opacity="0.5" fill="none" />
        ))}
        {clusters.map(([x, y], i) => (
          <g key={i}>
            {[
              [0, 0],
              [3, -2],
              [-3, -2],
              [2, 3],
              [-2, 3],
              [0, -4],
            ].map(([dx, dy], j) => (
              <circle key={j} cx={x + dx} cy={y + dy} r="1.3" fill="var(--w-accent)" opacity="0.85" />
            ))}
          </g>
        ))}
      </>
    );
  }
  if (style === "pampas") {
    // Feathery pampas-grass plumes — soft boho movement.
    const plumes = [
      { x: 12, y: 104, rot: -18, len: 72 },
      { x: 26, y: 108, rot: -4, len: 86 },
      { x: 40, y: 104, rot: 9, len: 74 },
    ];
    return (
      <>
        {plumes.map((pl, i) => (
          <g key={i} transform={`translate(${pl.x} ${pl.y}) rotate(${pl.rot})`}>
            <path d={`M0 0 L 0 ${-pl.len}`} stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
            {Array.from({ length: 12 }).map((_, j) => {
              const yy = -8 - (j * (pl.len - 8)) / 12;
              return (
                <g key={j}>
                  <path d={`M0 ${yy} q -6 -2 -10 -7`} stroke="currentColor" strokeWidth="0.5" opacity="0.55" fill="none" />
                  <path d={`M0 ${yy} q 6 -2 10 -7`} stroke="currentColor" strokeWidth="0.5" opacity="0.55" fill="none" />
                </g>
              );
            })}
          </g>
        ))}
      </>
    );
  }
  if (style === "sunflower") {
    // A bold sunflower with a seeded centre and a leaf.
    return (
      <>
        <path d="M8 8 C 24 28 34 56 40 96" stroke="currentColor" strokeWidth="1" opacity="0.5" fill="none" />
        <Leaf x={30} y={58} r={30} />
        <g transform="translate(30 30)">
          {Array.from({ length: 16 }).map((_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-15"
              rx="3"
              ry="8"
              transform={`rotate(${i * 22.5})`}
              fill="var(--w-accent-soft)"
              stroke="var(--w-accent)"
              strokeWidth="0.5"
            />
          ))}
          <circle r="7" fill="var(--w-primary-soft)" stroke="currentColor" strokeWidth="0.7" />
          {[
            [0, 0],
            [3, 2],
            [-3, 2],
            [2, -3],
            [-2, -3],
            [4, -1],
            [-4, -1],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.8" fill="var(--w-accent)" />
          ))}
        </g>
      </>
    );
  }
  // botanical (default) — a full, heavy corner bouquet: several stems, dense
  // foliage and a cluster of blossoms of varying sizes with buds.
  const LEAVES: { x: number; y: number; r: number }[] = [
    { x: 20, y: 22, r: -30 },
    { x: 30, y: 40, r: -20 },
    { x: 40, y: 60, r: -14 },
    { x: 50, y: 82, r: -8 },
    { x: 60, y: 104, r: -4 },
    { x: 38, y: 16, r: 40 },
    { x: 54, y: 26, r: 34 },
    { x: 68, y: 38, r: 28 },
    { x: 82, y: 52, r: 22 },
    { x: 24, y: 54, r: 58 },
    { x: 34, y: 76, r: 52 },
    { x: 46, y: 98, r: 46 },
    { x: 90, y: 34, r: 18 },
    { x: 16, y: 38, r: -52 },
    { x: 74, y: 66, r: 12 },
    { x: 58, y: 48, r: 68 },
  ];
  return (
    <>
      {/* three curving stems fanning from the corner */}
      <path d="M4 4 C 34 30 54 66 64 112" stroke="currentColor" strokeWidth="1.2" opacity="0.6" fill="none" />
      <path d="M4 4 C 40 16 64 30 92 44" stroke="currentColor" strokeWidth="1.1" opacity="0.55" fill="none" />
      <path d="M4 4 C 24 34 34 66 40 100" stroke="currentColor" strokeWidth="1" opacity="0.5" fill="none" />
      {LEAVES.map((l, i) => (
        <Leaf key={i} {...l} />
      ))}
      {/* cluster of blossoms, varied sizes */}
      <Blossom x={26} y={30} scale={1.25} />
      <Blossom x={64} y={106} scale={1.15} />
      <Blossom x={90} y={44} scale={0.95} />
      <Blossom x={46} y={62} scale={0.85} />
      <Blossom x={44} y={24} scale={0.7} />
      {/* buds */}
      {[
        { x: 60, y: 14, r: 20 },
        { x: 78, y: 28, r: 26 },
        { x: 34, y: 88, r: -10 },
      ].map((b, i) => (
        <g key={`b${i}`} transform={`translate(${b.x} ${b.y}) rotate(${b.r})`}>
          <path
            d="M0 0 C -2.5 -3 -2.5 -7 0 -9 C 2.5 -7 2.5 -3 0 0 Z"
            fill="var(--w-accent-soft)"
            stroke="var(--w-accent)"
            strokeWidth="0.6"
          />
        </g>
      ))}
    </>
  );
}

const POS: Record<string, string> = {
  tl: "left-0 top-0",
  tr: "right-0 top-0 -scale-x-100",
  bl: "left-0 bottom-0 -scale-y-100",
  br: "right-0 bottom-0 -scale-x-100 -scale-y-100",
};

export function MarriageFloral({
  position,
  size = 220,
  variant = "botanical",
  className = "",
}: {
  position: "tl" | "tr" | "bl" | "br";
  size?: number;
  variant?: MarriageFloralStyle;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute ${POS[position]} ${className}`}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 140 140" fill="none">
        <StylePaths style={variant} />
      </svg>
    </div>
  );
}

export default MarriageFloral;
