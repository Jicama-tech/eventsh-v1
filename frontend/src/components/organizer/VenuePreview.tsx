import { forwardRef } from "react";
import VenueAnnotationLayer, {
  type VenueAnnotation,
} from "./VenueAnnotationLayer";
import { FacilityCourtMarkings } from "@/lib/facilityCourtLines";

/**
 * Read-only, eventfront-style render of a single venue layout. Used by the
 * designer's "Preview" dialog (and its PDF export) so the organizer sees the
 * venue the way visitors will — cropped to the visible area, spaces in their
 * solid colours with bold labels, round tables / doors / annotations included,
 * plus scheduled (bookable-by-slot) spaces and speaker zones so nothing the
 * organizer placed on the layout is silently missing from the preview.
 *
 * Coordinates are logical units; `scale` converts to display px (same basis
 * as the eventfront map, which renders at 1px per logical unit before its own
 * fit-to-width scaling).
 */
interface Props {
  config: any;
  tables: any[];
  roundTables: any[];
  doors: any[];
  annotations: VenueAnnotation[];
  /** Individual cinema/concert seats — optional, older callers omit these. */
  seats?: any[];
  /** Row declarations (label/tier/color) the seats above reference. */
  seatRowTemplates?: any[];
  /** Scheduled spaces (courts/rooms booked by time slot) placed on this
   *  layout — optional, older callers omit these. */
  scheduledSpaces?: any[];
  /** Speaker zones placed on this layout — optional, older callers omit these. */
  speakerZones?: any[];
  /** Display px per logical unit. */
  scale?: number;
}

const VenuePreview = forwardRef<HTMLDivElement, Props>(function VenuePreview(
  {
    config,
    tables,
    roundTables,
    doors,
    annotations,
    seats = [],
    seatRowTemplates = [],
    scheduledSpaces = [],
    speakerZones = [],
    scale = 1,
  },
  ref,
) {
  const cropped = !!config?.cropped;
  const W =
    (cropped ? config?.cropWidth : config?.width) || config?.width || 800;
  const H =
    (cropped ? config?.cropHeight : config?.height) || config?.height || 500;
  const s = scale;
  const grid = config?.gridSize || 40;
  const inCrop = (x?: number, y?: number) =>
    !cropped || ((Number(x) || 0) < W && (Number(y) || 0) < H);

  const doorColor = (d: any) => {
    const t = (d?.type || "").toLowerCase();
    return t === "entrance"
      ? "#16a34a"
      : t === "exit"
        ? "#dc2626"
        : d?.color || "#f97316";
  };

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: W * s,
        height: H * s,
        backgroundColor: "#ffffff",
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)",
        backgroundSize: `${grid * s}px ${grid * s}px`,
        border: "1px solid #d1d5db",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {/* Main stage — true position/size, including a drag if the
          organizer moved it off its default centered-at-top spot. */}
      {config?.hasMainStage && (
        <div
          style={{
            position: "absolute",
            left:
              config?.mainStageX != null
                ? config.mainStageX * s
                : (W - (config?.mainStageWidth ?? 200)) / 2 * s,
            top: (config?.mainStageY ?? 0) * s,
            width: (config?.mainStageWidth ?? 200) * s,
            height: (config?.mainStageHeight ?? 60) * s,
            borderRadius:
              config?.mainStageShape === "semicircle"
                ? "0 0 50% 50% / 0 0 100% 100%"
                : config?.mainStageShape === "circle"
                  ? "50%"
                  : 6,
            backgroundColor: "#e9d5ff",
            border: "2px solid #a855f7",
            color: "#7c3aed",
            fontWeight: 700,
            fontSize: Math.max(8, 11 * s),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textTransform: "uppercase",
            zIndex: 10,
          }}
        >
          {config?.mainStageLabel || "Main Stage"}
        </div>
      )}

      {/* Spaces — solid template colour + bold white label (eventfront look) */}
      {tables
        .filter((t) => inCrop(t.x, t.y))
        .map((t) => {
          const notForSale = t.forSale === false;
          const color = t.color || (notForSale ? "#f59e0b" : "#22c55e");
          const w = (t.displayWidth ?? t.width ?? 50) * s;
          const h = (t.displayHeight ?? t.height ?? 50) * s;
          return (
            <div
              key={t.positionId}
              style={{
                position: "absolute",
                left: (t.x || 0) * s,
                top: (t.y || 0) * s,
                width: w,
                height: h,
                transform: `rotate(${t.rotation || 0}deg)`,
                transformOrigin: "center center",
                backgroundColor: color + (notForSale ? "59" : "80"),
                border: `1px solid ${color}`,
                borderRadius:
                  t.type === "Round" ? "50%" : t.type === "Corner" ? 6 : 3,
                ...(notForSale
                  ? {
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                    }
                  : {}),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 5,
              }}
            >
              <span
                style={{
                  color: "#111827",
                  fontWeight: 800,
                  fontSize: Math.max(6, 8 * s),
                  lineHeight: 1,
                  textAlign: "center",
                  padding: 1,
                  overflow: "hidden",
                }}
              >
                {t.name}
              </span>
            </div>
          );
        })}

      {/* Round tables — circle + chair ring */}
      {roundTables
        .filter((rt) => inCrop(rt.x, rt.y))
        .map((rt) => {
          const col = rt.color || "#8B5CF6";
          const d = (rt.tableDiameter || 120) * s;
          const chairSz = Math.max(6, d * 0.13);
          const chairR = d / 2 + chairSz / 2 + 3;
          const cx = (rt.x || 0) * s + d / 2;
          const cy = (rt.y || 0) * s + d / 2;
          const chairs = rt.numberOfChairs || 0;
          return (
            <div key={rt.positionId}>
              <div
                style={{
                  position: "absolute",
                  left: cx - d / 2,
                  top: cy - d / 2,
                  width: d,
                  height: d,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 40% 35%, ${col}25, ${col}10)`,
                  border: `1.5px solid ${col}99`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                }}
              >
                <span
                  style={{
                    fontSize: Math.max(6, 8 * s),
                    fontWeight: 800,
                    color: col,
                    textAlign: "center",
                    lineHeight: 1.1,
                    padding: "0 2px",
                  }}
                >
                  {rt.name}
                </span>
              </div>
              {Array.from({ length: chairs }).map((_, i) => {
                const a = (2 * Math.PI * i) / chairs - Math.PI / 2;
                const px = cx + chairR * Math.cos(a) - chairSz / 2;
                const py = cy + chairR * Math.sin(a) - chairSz / 2;
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: px,
                      top: py,
                      width: chairSz,
                      height: chairSz,
                      borderRadius: "50%",
                      backgroundColor: col,
                      border: "1px solid rgba(255,255,255,0.8)",
                      zIndex: 6,
                    }}
                  />
                );
              })}
            </div>
          );
        })}

      {/* Scheduled spaces — mirrors the eventfront look (solid colour, court
          markings, white name + facility type). Footprint comes from the
          shape: circles use their diameter, rectangles width × height. */}
      {scheduledSpaces
        .filter((space) => inCrop(space.x, space.y))
        .map((space) => {
          const isCircle = space.shape === "Circle";
          const w = (isCircle ? space.diameter : space.width) || 100;
          const h = (isCircle ? space.diameter : space.height) || 100;
          return (
            <div
              key={`ss-${space.positionId}`}
              style={{
                position: "absolute",
                left: (space.x || 0) * s,
                top: (space.y || 0) * s,
                width: w * s,
                height: h * s,
                transform: `rotate(${space.rotation || 0}deg)`,
                transformOrigin: "center center",
                backgroundColor: space.color || "#3b82f6",
                border: `2px solid ${space.color ? space.color + "88" : "#1d4ed8"}`,
                borderRadius: isCircle ? "50%" : 6,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                zIndex: 5,
              }}
            >
              {/* Court/field lines so the box reads as the chosen facility.
                  The idSeed becomes an SVG clipPath id, and this preview can
                  be mounted alongside the designer canvas (which seeds with
                  the bare positionId), so prefix it to keep the ids unique. */}
              <FacilityCourtMarkings
                facilityType={space.facilityType}
                isCircle={isCircle}
                idSeed={`pv-${space.positionId}`}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  textAlign: "center",
                  padding: 1,
                  overflow: "hidden",
                  maxWidth: "100%",
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: Math.max(6, 9 * s),
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {space.name}
                </div>
                <div
                  style={{
                    fontSize: Math.max(5, 7 * s),
                    opacity: 0.9,
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {space.facilityType}
                </div>
              </div>
            </div>
          );
        })}

      {/* Speaker zones — same purple gradient block as the designer canvas,
          labelled with the zone name and its time range when one is set. */}
      {speakerZones
        .filter((zone) => inCrop(zone.x, zone.y))
        .map((zone) => (
          <div
            key={`sz-${zone.positionId}`}
            style={{
              position: "absolute",
              left: (zone.x || 0) * s,
              top: (zone.y || 0) * s,
              width: (zone.width || 0) * s,
              height: (zone.height || 0) * s,
              background: "linear-gradient(135deg, #a855f7, #8b5cf6)",
              border: "2px solid #7c3aed",
              borderRadius: 10,
              color: "#fff",
              fontWeight: 700,
              fontSize: Math.max(6, 9 * s),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              zIndex: 5,
            }}
          >
            <div
              style={{
                textAlign: "center",
                padding: 1,
                overflow: "hidden",
                maxWidth: "100%",
              }}
            >
              <div
                style={{
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {zone.name}
              </div>
              <div
                style={{
                  fontSize: Math.max(5, 7 * s),
                  opacity: 0.85,
                  lineHeight: 1.1,
                }}
              >
                {zone.startTime
                  ? `${zone.startTime} - ${zone.endTime}`
                  : "SPEAKER ZONE"}
              </div>
            </div>
          </div>
        ))}

      {/* Doors */}
      {doors
        .filter((d) => inCrop(d.x, d.y))
        .map((d) => {
          const isSquare = d?.shape === "square";
          const w = (Number(d?.width) > 0 ? Number(d.width) : 50) * s;
          const h = (Number(d?.height) > 0 ? Number(d.height) : 50) * s;
          const col = doorColor(d);
          const label =
            d?.label ||
            ((d?.type || "").toLowerCase() === "entrance"
              ? "IN"
              : (d?.type || "").toLowerCase() === "exit"
                ? "OUT"
                : "DOOR");
          return (
            <div
              key={d.id || `${d.x}-${d.y}`}
              style={{
                position: "absolute",
                left: (d.x || 0) * s,
                top: (d.y || 0) * s,
                width: w,
                height: h,
                transform: `rotate(${d.rotation || 0}deg)`,
                transformOrigin: "center center",
                backgroundColor: col,
                border: "2px solid rgba(0,0,0,0.25)",
                borderRadius: isSquare ? 4 : "50%",
                color: "#fff",
                fontWeight: 700,
                fontSize: Math.max(6, 8 * s),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 6,
              }}
            >
              {label}
            </div>
          );
        })}

      {/* Cinema/concert seats — small square per seat, colored by its row. */}
      {seats
        .filter((seat) => inCrop(seat.x, seat.y))
        .map((seat) => {
          const row = seatRowTemplates.find((r) => r.id === seat.rowId);
          const size = Math.max(6, 26 * s);
          return (
            <div
              key={seat.id}
              title={
                seat.name || `${row?.name || "Seat"}${seat.seatNumber}`
              }
              style={{
                position: "absolute",
                left: (seat.x || 0) * s,
                top: (seat.y || 0) * s,
                width: size,
                height: size,
                // Proportional to the seat's own rendered size, not a fixed
                // px value that would swallow a small seat and look round.
                borderRadius: Math.max(1, size * 0.16),
                backgroundColor: seat.color || "#8B5CF6",
                border: "1px solid rgba(255,255,255,0.6)",
                color: "#fff",
                fontWeight: 700,
                fontSize: Math.max(5, size * 0.4),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                overflow: "hidden",
                zIndex: 6,
                transform: seat.rotation
                  ? `rotate(${seat.rotation}deg)`
                  : undefined,
              }}
            >
              {size >= 10 ? seat.name || seat.seatNumber : ""}
            </div>
          );
        })}

      {/* CAD annotations (read-only) */}
      {annotations.length > 0 && (
        <VenueAnnotationLayer
          readOnly
          width={W * s}
          height={H * s}
          scale={s}
          zIndex={4}
          annotations={annotations.filter((a) =>
            inCrop(
              (a as any).x ??
                (Array.isArray((a as any).points) ? (a as any).points[0] : 0),
              (a as any).y ??
                (Array.isArray((a as any).points) ? (a as any).points[1] : 0),
            ),
          )}
        />
      )}
    </div>
  );
});

export default VenuePreview;
