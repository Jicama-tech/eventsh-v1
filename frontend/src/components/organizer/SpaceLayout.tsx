import { forwardRef, type CSSProperties, type ReactNode } from "react";
import VenueAnnotationLayer, {
  type VenueAnnotation,
} from "./VenueAnnotationLayer";

/**
 * Shared, eventfront-style renderer for a single venue layout. This is the ONE
 * place that knows how a venue map looks — grid, main stage, rectangular spaces
 * in their template colours with bold labels, round tables with a chair ring,
 * doors and CAD annotations. Every screen that draws a venue (the public
 * eventfront, the stall-selection dialog, the operator/volunteer view and the
 * organizer participants tab) renders through this component so they can never
 * visually drift apart again.
 *
 * The colour rule mirrors the public eventfront page:
 *   available / sellable → the space's own template colour (`color` + 80 alpha)
 *   booked / disabled    → grey
 *   not-for-sale         → amber hatch
 *   selected             → blue ring on top of the template colour
 *   paid / approved / …  → a small corner badge (status is never a fill)
 *
 * Coordinates are logical units; `scale` converts to display px (1px per
 * logical unit by default, matching the eventfront map basis).
 */

export interface SpaceState {
  /** Blue selection ring + raised z-index. Keeps the template-colour fill. */
  selected?: boolean;
  /** Greys the space out (booked / sold). Defaults to `table.isBooked`. */
  booked?: boolean;
  /** Amber hatch, non-interactive. Defaults to `table.forSale === false`. */
  notForSale?: boolean;
  /** Greyed + not clickable (e.g. wrong template / category for this buyer). */
  disabled?: boolean;
  /** Small upright pill in the top-right corner — used for paid/approved/etc. */
  badge?: { text: string; color?: string; textColor?: string };
  /** Override the selection ring colour (default blue #3b82f6). */
  ringColor?: string;
  /** Native hover tooltip on the space (e.g. "A1 — Approved · Acme Foods"). */
  title?: string;
  /** Explicit fill colour override — wins over template / booked greys. Lets a
   *  caller paint booked spaces a distinct colour while keeping them clickable
   *  (e.g. the volunteer view marks booked stalls dark grey). */
  fill?: string;
  /** Explicit border colour override, paired with `fill`. */
  border?: string;
}

export interface SpaceLayoutProps {
  config: any;
  tables?: any[];
  roundTables?: any[];
  doors?: any[];
  speakerZones?: any[];
  annotations?: VenueAnnotation[];
  /** Display px per logical unit. */
  scale?: number;
  /** When the config is cropped, clip the canvas + spaces to the crop box. */
  crop?: boolean;
  /** Show the dotted grid background. Defaults to `config.showGrid ?? true`. */
  showGrid?: boolean;
  /** Per-space visual state (selection / booked / badge …). */
  getState?: (table: any) => SpaceState;
  /** Click handler for a (non-disabled) rectangular space. */
  onSpaceClick?: (table: any) => void;
  /** Replace the default bold label inside a rectangular space. */
  renderSpaceLabel?: (table: any, state: SpaceState) => ReactNode;
  /** Wrap each rendered space node — e.g. with a HoverCard / Tooltip. */
  wrapSpace?: (table: any, node: ReactNode) => ReactNode;
  /** Extra content rendered inside a round table (e.g. seat counts). */
  renderRoundLabel?: (rt: any) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

const GREY_FILL = "#9ca3af80"; // slate-400 @ 50%
const GREY_BORDER = "#6b7280"; // slate-500
const RING_BLUE = "#3b82f6";

const doorColor = (d: any) => {
  const t = (d?.type || "").toLowerCase();
  return t === "entrance"
    ? "#16a34a"
    : t === "exit"
      ? "#dc2626"
      : d?.color || "#f97316";
};

const SpaceLayout = forwardRef<HTMLDivElement, SpaceLayoutProps>(
  function SpaceLayout(
    {
      config,
      tables = [],
      roundTables = [],
      doors = [],
      speakerZones = [],
      annotations = [],
      scale = 1,
      crop = false,
      showGrid,
      getState,
      onSpaceClick,
      renderSpaceLabel,
      wrapSpace,
      renderRoundLabel,
      className,
      style,
    },
    ref,
  ) {
    const cropped = crop && !!config?.cropped;
    const W =
      (cropped ? config?.cropWidth : config?.width) || config?.width || 800;
    const H =
      (cropped ? config?.cropHeight : config?.height) || config?.height || 500;
    const s = scale;
    const grid = config?.gridSize || 40;
    const gridOn = showGrid ?? config?.showGrid ?? true;
    const inCrop = (x?: number, y?: number) =>
      !cropped || ((Number(x) || 0) < W && (Number(y) || 0) < H);

    return (
      <div
        ref={ref}
        className={className}
        style={{
          position: "relative",
          width: W * s,
          height: H * s,
          backgroundColor: "#ffffff",
          backgroundImage: gridOn
            ? "linear-gradient(to right, rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.06) 1px, transparent 1px)"
            : "none",
          backgroundSize: `${grid * s}px ${grid * s}px`,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          overflow: "hidden",
          ...style,
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

        {/* Speaker zones (operator view) */}
        {speakerZones
          .filter((z) => inCrop(z.x, z.y))
          .map((zone) => (
            <div
              key={`sz-${zone.positionId}`}
              title={zone.name}
              style={{
                position: "absolute",
                left: (zone.x || 0) * s,
                top: (zone.y || 0) * s,
                width: (zone.width || 100) * s,
                height: (zone.height || 60) * s,
                transform: `rotate(${zone.rotation || 0}deg)`,
                transformOrigin: "center center",
                background: zone.isMainStage
                  ? "linear-gradient(135deg,#a855f7,#8b5cf6)"
                  : "linear-gradient(135deg,#9ca3af,#6b7280)",
                border: `2px solid ${zone.isMainStage ? "#7c3aed" : "#4b5563"}`,
                borderRadius: 6,
                color: "#fff",
                fontWeight: 700,
                fontSize: Math.max(7, 9 * s),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 5,
              }}
            >
              {zone.isMainStage ? "STAGE" : zone.name}
            </div>
          ))}

        {/* Rectangular spaces — template colour + bold label (eventfront look) */}
        {tables
          .filter((t) => inCrop(t.x, t.y))
          .map((t) => {
            const st = getState?.(t) || {};
            const notForSale = st.notForSale ?? t.forSale === false;
            const booked = st.booked ?? !!t.isBooked;
            const disabled = !!st.disabled;
            const selected = !!st.selected;
            const grey = booked || disabled;
            const tpl = t.color || (notForSale ? "#f59e0b" : "#22c55e");

            // Fill / border per state.
            let bg = tpl + "80";
            let border = tpl;
            if (notForSale) bg = tpl + "59";
            if (grey) {
              bg = GREY_FILL;
              border = GREY_BORDER;
            }
            // Explicit caller override (e.g. booked spaces painted dark grey in
            // the volunteer view) wins over the defaults above.
            if (st.fill) bg = st.fill;
            if (st.border) border = st.border;

            const rot = t.rotation || 0;
            const w = (t.displayWidth ?? t.width ?? 50) * s;
            const h = (t.displayHeight ?? t.height ?? 50) * s;
            const clickable = !!onSpaceClick && !disabled && !booked && !notForSale;

            const node = (
              <div
                key={t.positionId}
                title={st.title}
                onClick={clickable ? () => onSpaceClick!(t) : undefined}
                style={{
                  position: "absolute",
                  left: (t.x || 0) * s,
                  top: (t.y || 0) * s,
                  width: w,
                  height: h,
                  transform: `rotate(${rot}deg)`,
                  transformOrigin: "center center",
                  backgroundColor: bg,
                  border: `1px solid ${border}`,
                  borderRadius:
                    t.type === "Round" ? "50%" : t.type === "Corner" ? 6 : 3,
                  boxShadow: selected
                    ? `0 0 0 2px ${st.ringColor || RING_BLUE}`
                    : undefined,
                  ...(notForSale
                    ? {
                        backgroundImage:
                          "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 6px)",
                      }
                    : {}),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: clickable
                    ? "pointer"
                    : onSpaceClick && (booked || disabled)
                      ? "not-allowed"
                      : "default",
                  zIndex: selected ? 10 : 5,
                }}
              >
                {/* Counter-rotate the content so labels stay upright. */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    transform: `rotate(${-rot}deg)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {renderSpaceLabel ? (
                    renderSpaceLabel(t, st)
                  ) : (
                    <span
                      style={{
                        color: grey ? "#1f2937" : "#111827",
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
                  )}
                </div>

                {/* Status badge (paid / approved / sold …) — upright pill. */}
                {st.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: 1,
                      right: 1,
                      transform: `rotate(${-rot}deg)`,
                      transformOrigin: "top right",
                      backgroundColor: st.badge.color || "#111827",
                      color: st.badge.textColor || "#ffffff",
                      fontSize: Math.max(5, 6.5 * s),
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: "1px 3px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      zIndex: 11,
                    }}
                  >
                    {st.badge.text}
                  </div>
                )}
              </div>
            );

            return wrapSpace ? (
              <span key={t.positionId}>{wrapSpace(t, node)}</span>
            ) : (
              node
            );
          })}

        {/* Round tables — faint circle + numbered seat ring (eventfront look,
            read-only). Not-for-sale tables render as a 0.7-opacity, faintly
            hatched "reference" circle exactly like the public event page. */}
        {roundTables
          .filter((rt) => inCrop(rt.x, rt.y))
          .map((rt) => {
            const col = rt.color || "#8B5CF6";
            const notForSale = rt.forSale === false;
            const diameterLogical = rt.tableDiameter || 120;
            const d = diameterLogical * s;
            const chairSz = Math.max(12, diameterLogical * 0.14) * s;
            const chairR = d / 2 + chairSz / 2 + 4 * s;
            const cx = (rt.x || 0) * s + d / 2;
            const cy = (rt.y || 0) * s + d / 2;
            const chairs = rt.numberOfChairs || 0;
            const booked: number[] = Array.isArray(rt.bookedChairs)
              ? rt.bookedChairs
              : [];
            return (
              <div key={rt.positionId}>
                <div
                  title={notForSale ? `${rt.name} — Not for sale` : rt.name}
                  style={{
                    position: "absolute",
                    left: cx - d / 2,
                    top: cy - d / 2,
                    width: d,
                    height: d,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 40% 35%, ${col}18, ${col}08)`,
                    border: `1.5px solid ${col}55`,
                    opacity: notForSale ? 0.7 : 1,
                    backgroundImage: notForSale
                      ? "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 6px)"
                      : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 5,
                  }}
                >
                  {renderRoundLabel ? (
                    renderRoundLabel(rt)
                  ) : (
                    <span
                      style={{
                        fontSize: Math.max(7, 9 * s),
                        fontWeight: 800,
                        color: col,
                        textAlign: "center",
                        lineHeight: 1.1,
                        padding: "0 2px",
                      }}
                    >
                      {rt.name}
                    </span>
                  )}
                </div>
                {Array.from({ length: chairs }).map((_, i) => {
                  const a = (2 * Math.PI * i) / chairs - Math.PI / 2;
                  const px = cx + chairR * Math.cos(a) - chairSz / 2;
                  const py = cy + chairR * Math.sin(a) - chairSz / 2;
                  const isBooked = booked.includes(i);
                  return (
                    <div
                      key={i}
                      title={`Seat ${i + 1} — ${isBooked ? "Taken" : "Available"}`}
                      style={{
                        position: "absolute",
                        left: px,
                        top: py,
                        width: chairSz,
                        height: chairSz,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: Math.max(6, chairSz * 0.45),
                        fontWeight: 700,
                        color: isBooked ? "#9ca3af" : "#ffffff",
                        backgroundColor: isBooked ? "#f3f4f6" : col,
                        border: isBooked
                          ? "1.5px solid #d1d5db"
                          : "1.5px solid rgba(255,255,255,0.8)",
                        opacity: isBooked ? 0.6 : 1,
                        zIndex: 7,
                      }}
                    >
                      {i + 1}
                    </div>
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
            const type = (d?.type || "").toLowerCase();
            const label =
              d?.label || (type === "entrance" ? "IN" : type === "exit" ? "OUT" : "DOOR");
            return (
              <div
                key={d.id || `${d.x}-${d.y}`}
                title={type === "entrance" ? "Entrance" : type === "exit" ? "Exit" : "Door"}
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
  },
);

export default SpaceLayout;
