import React from "react";

// Stylised court/field markings drawn on top of a placed Scheduled Space so
// it visually reads as the real facility (a Tennis Court LOOKS like a tennis
// court) instead of a plain colored box. Coordinates are on a 0–100 grid
// (the <svg> stretches this to the box's actual width/height, so it scales
// with resize), lines are a translucent white matching real court markings
// painted on a colored surface. Custom ("Other") facility types fall back to
// no markings — we don't know what to draw for an arbitrary name.
//
// Shared between the organizer's Space Layout canvas (CreateEventForm.tsx)
// and the visitor-facing Venue Layout on the public eventfront
// (eventFront.tsx) so a Tennis Court looks the same court in both places.
const FACILITY_LINE_STROKE = "rgba(255,255,255,0.85)";

export function renderFacilityCourtLines(facilityType: string): React.ReactNode {
  const stroke = FACILITY_LINE_STROKE;
  const sw = 1.6;
  switch (facilityType) {
    case "Tennis Court":
      return (
        <>
          <line x1={8} y1={0} x2={8} y2={100} stroke={stroke} strokeWidth={sw} />
          <line x1={92} y1={0} x2={92} y2={100} stroke={stroke} strokeWidth={sw} />
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw + 0.4} />
          <line x1={8} y1={25} x2={92} y2={25} stroke={stroke} strokeWidth={sw} />
          <line x1={8} y1={75} x2={92} y2={75} stroke={stroke} strokeWidth={sw} />
          <line x1={50} y1={25} x2={50} y2={75} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case "Badminton Court":
      return (
        <>
          <line x1={5} y1={0} x2={5} y2={100} stroke={stroke} strokeWidth={sw} />
          <line x1={95} y1={0} x2={95} y2={100} stroke={stroke} strokeWidth={sw} />
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw + 0.4} />
          <line x1={5} y1={20} x2={95} y2={20} stroke={stroke} strokeWidth={sw} />
          <line x1={5} y1={80} x2={95} y2={80} stroke={stroke} strokeWidth={sw} />
          <line x1={50} y1={0} x2={50} y2={20} stroke={stroke} strokeWidth={sw} />
          <line x1={50} y1={80} x2={50} y2={100} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case "Basketball Court":
      return (
        <>
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw} />
          <circle cx={50} cy={50} r={12} stroke={stroke} strokeWidth={sw} fill="none" />
          <rect x={35} y={0} width={30} height={19} stroke={stroke} strokeWidth={sw} fill="none" />
          <circle cx={50} cy={19} r={12} stroke={stroke} strokeWidth={sw} fill="none" />
          <rect x={35} y={81} width={30} height={19} stroke={stroke} strokeWidth={sw} fill="none" />
          <circle cx={50} cy={81} r={12} stroke={stroke} strokeWidth={sw} fill="none" />
        </>
      );
    case "Football Ground":
      return (
        <>
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw} />
          <circle cx={50} cy={50} r={10} stroke={stroke} strokeWidth={sw} fill="none" />
          <circle cx={50} cy={50} r={1.2} fill={stroke} />
          <rect x={20} y={0} width={60} height={15} stroke={stroke} strokeWidth={sw} fill="none" />
          <rect x={35} y={0} width={30} height={6} stroke={stroke} strokeWidth={sw} fill="none" />
          <rect x={20} y={85} width={60} height={15} stroke={stroke} strokeWidth={sw} fill="none" />
          <rect x={35} y={94} width={30} height={6} stroke={stroke} strokeWidth={sw} fill="none" />
        </>
      );
    case "Volleyball Court":
      return (
        <>
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw + 0.6} />
          <line x1={0} y1={33} x2={100} y2={33} stroke={stroke} strokeWidth={sw} />
          <line x1={0} y1={67} x2={100} y2={67} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case "Swimming Pool":
      return (
        <>
          {[16.6, 33.3, 50, 66.6, 83.3].map((x) => (
            <line
              key={x}
              x1={x}
              y1={2}
              x2={x}
              y2={98}
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray="4 3"
            />
          ))}
        </>
      );
    case "Table Tennis Court":
      return (
        <>
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw + 0.8} />
          <line x1={50} y1={0} x2={50} y2={100} stroke={stroke} strokeWidth={sw * 0.7} />
        </>
      );
    case "Squash Court":
      return (
        <>
          <line x1={0} y1={90} x2={100} y2={90} stroke={stroke} strokeWidth={sw} />
          <line x1={0} y1={50} x2={100} y2={50} stroke={stroke} strokeWidth={sw} />
          <rect x={10} y={50} width={25} height={16} stroke={stroke} strokeWidth={sw} fill="none" />
          <rect x={65} y={50} width={25} height={16} stroke={stroke} strokeWidth={sw} fill="none" />
        </>
      );
    case "Cricket Ground":
      return (
        <>
          <rect x={42} y={8} width={16} height={84} stroke={stroke} strokeWidth={sw} fill="none" />
          <line x1={42} y1={16} x2={58} y2={16} stroke={stroke} strokeWidth={sw} />
          <line x1={42} y1={84} x2={58} y2={84} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case "Chess Court":
      return (
        <>
          {Array.from({ length: 4 }).flatMap((_, row) =>
            Array.from({ length: 4 }).map((_, col) =>
              (row + col) % 2 === 0 ? (
                <rect
                  key={`${row}-${col}`}
                  x={col * 25}
                  y={row * 25}
                  width={25}
                  height={25}
                  fill="rgba(255,255,255,0.25)"
                />
              ) : null,
            ),
          )}
        </>
      );
    default:
      return null;
  }
}

// Full drop-in overlay: the <svg> element itself (viewBox stretched to fill
// the parent, clipped to a circle for round facilities) — callers just
// position a relatively-positioned wrapper and drop this in as a child.
export function FacilityCourtMarkings({
  facilityType,
  isCircle,
  idSeed,
}: {
  facilityType: string;
  isCircle: boolean;
  /** Unique per placed instance — becomes the clipPath id, so two facilities
   *  on the same page never clip each other. */
  idSeed: string;
}) {
  const lines = renderFacilityCourtLines(facilityType);
  if (!lines) return null;
  const clipId = `factyclip-${idSeed}`;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
      }}
    >
      {isCircle && (
        <defs>
          <clipPath id={clipId}>
            <circle cx={50} cy={50} r={50} />
          </clipPath>
        </defs>
      )}
      <g clipPath={isCircle ? `url(#${clipId})` : undefined}>{lines}</g>
    </svg>
  );
}
