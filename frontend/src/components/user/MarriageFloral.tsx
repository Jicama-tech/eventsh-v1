// A botanical corner spray — curving stems with line-art leaves and a couple
// of small blossoms — used to frame the wedding hero like a luxury invitation.
// Drawn once anchored at the top-left and flipped into the other corners.
// Tinted with the theme's primary (stems/leaves) and accent (blossoms), at low
// opacity so it decorates without competing with the names/photo.

const LEAVES: { x: number; y: number; r: number }[] = [
  { x: 22, y: 24, r: -28 },
  { x: 33, y: 45, r: -18 },
  { x: 44, y: 67, r: -12 },
  { x: 55, y: 92, r: -6 },
  { x: 40, y: 18, r: 38 },
  { x: 56, y: 28, r: 32 },
  { x: 70, y: 39, r: 26 },
];

function Leaf({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path
        d="M0 0 C -3.5 -5 -3.5 -12 0 -17 C 3.5 -12 3.5 -5 0 0 Z"
        fill="var(--w-primary-soft)"
        stroke="currentColor"
        strokeWidth="0.7"
      />
      <path d="M0 -1.5 L 0 -15" stroke="currentColor" strokeWidth="0.5" opacity="0.7" />
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

const POS: Record<string, string> = {
  tl: "left-0 top-0",
  tr: "right-0 top-0 -scale-x-100",
  bl: "left-0 bottom-0 -scale-y-100",
  br: "right-0 bottom-0 -scale-x-100 -scale-y-100",
};

export function MarriageFloral({
  position,
  size = 170,
  className = "",
}: {
  position: "tl" | "tr" | "bl" | "br";
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute ${POS[position]} ${className}`}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 140 140" fill="none">
        {/* stems */}
        <path d="M6 6 C 34 30 52 64 60 104" stroke="currentColor" strokeWidth="1.1" opacity="0.6" />
        <path d="M18 10 C 40 16 58 28 74 40" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        {/* foliage */}
        {LEAVES.map((l, i) => (
          <Leaf key={i} {...l} />
        ))}
        {/* blossoms + bud */}
        <Blossom x={62} y={104} />
        <Blossom x={76} y={40} scale={0.85} />
        <g transform="translate(58 13) rotate(20)">
          <path
            d="M0 0 C -2.5 -3 -2.5 -7 0 -9 C 2.5 -7 2.5 -3 0 0 Z"
            fill="var(--w-accent-soft)"
            stroke="var(--w-accent)"
            strokeWidth="0.6"
          />
        </g>
      </svg>
    </div>
  );
}

export default MarriageFloral;
