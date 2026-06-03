import { forwardRef } from "react";
import VenueAnnotationLayer, {
  type VenueAnnotation,
} from "./VenueAnnotationLayer";

/**
 * Read-only, eventfront-style render of a single venue layout. Used by the
 * designer's "Preview" dialog (and its PDF export) so the organizer sees the
 * venue the way visitors will — cropped to the visible area, spaces in their
 * solid colours with bold labels, round tables / doors / annotations included.
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
  /** Display px per logical unit. */
  scale?: number;
}

const VenuePreview = forwardRef<HTMLDivElement, Props>(function VenuePreview(
  { config, tables, roundTables, doors, annotations, scale = 1 },
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
      {/* Main stage */}
      {config?.hasMainStage && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 200 * s,
            height: 60 * s,
            backgroundColor: "#e9d5ff",
            border: "2px solid #a855f7",
            color: "#7c3aed",
            fontWeight: 700,
            fontSize: Math.max(8, 11 * s),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          MAIN STAGE
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
