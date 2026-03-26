const BlurOverlay = ({ children, visible = false, blurAmount = 6 }) => (
  <div style={{ position: "relative" }}>
    {/* Content with blur effect */}
    <div
      style={{
        filter: visible ? `blur(${blurAmount}px)` : "none",
        pointerEvents: visible ? "none" : "auto",
      }}
    >
      {children}
    </div>
    {/* Overlay to indicate disabled/blurred */}
    {visible && (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255,255,255,0.4)", // semi-transparent overlay
          zIndex: 2,
          pointerEvents: "all",
          cursor: "not-allowed",
        }}
      />
    )}
  </div>
);

export default BlurOverlay;
