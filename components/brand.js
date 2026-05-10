// Brand assets for ninthinning.email — diamond glyph + wordmark.
// Source of truth for the SVG marks defined in the brand sheet (v1.0,
// "diamond / four bases"). Tokens:
//   ballpark green #2d5a3d · stitch red #b8312f · paper #f7f5ef
//   night #0f1311 · green-light #7fb295 · ink #1a1d1c

export function DiamondGlyph({
  size = 40,
  variant = "default",
  className,
  title,
}) {
  // variant: "default" (paper-on-green tile), "dark" (no tile, paper outline,
  // softened red), "light" (paper tile, green outline)
  const tileFill =
    variant === "light" ? "#f7f5ef" : variant === "dark" ? "transparent" : "#2d5a3d";
  const stroke =
    variant === "light" ? "#2d5a3d" : variant === "dark" ? "#7fb295" : "#f7f5ef";
  const home = variant === "dark" ? "#d05a55" : "#b8312f";
  const baseFill =
    variant === "light" ? "#2d5a3d" : variant === "dark" ? "#7fb295" : "#f7f5ef";
  const showTile = variant !== "dark";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {showTile && <rect width="100" height="100" rx="22" fill={tileFill} />}
      <rect
        x="50"
        y="14"
        width="50.91"
        height="50.91"
        transform="rotate(45 50 14)"
        fill="none"
        stroke={stroke}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="86" r="4.5" fill={home} />
      <circle cx="14" cy="50" r="3.2" fill={baseFill} />
      <circle cx="86" cy="50" r="3.2" fill={baseFill} />
      <circle cx="50" cy="14" r="3.2" fill={baseFill} />
    </svg>
  );
}

export function DiamondPeriod({ size = 11, color = "#2d5a3d" }) {
  // The wordmark's period: a tiny solid diamond in ballpark green by default.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "baseline" }}
    >
      <rect
        x="10"
        y="3"
        width="9.9"
        height="9.9"
        transform="rotate(45 10 3)"
        fill={color}
      />
    </svg>
  );
}

// Wordmark: lowercase "ninthinning" + tiny diamond + "email", per brand sheet.
// Sized via inherited font-size; periodColor flips for dark/grass surfaces.
export function Wordmark({
  className = "",
  periodColor = "#2d5a3d",
  periodSize = 11,
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily:
          "'General Sans','Hanken Grotesk',system-ui,sans-serif",
        fontWeight: 500,
        letterSpacing: "-0.015em",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "baseline",
      }}
    >
      ninthinning
      <span style={{ display: "inline-flex", alignItems: "baseline", margin: "0 0.05em" }}>
        <DiamondPeriod size={periodSize} color={periodColor} />
      </span>
      email
    </span>
  );
}

// Header lockup: glyph + wordmark, links home. Pass `dark` on dark surfaces
// to flip the period color to green-light for legibility.
export function BrandLockup({ glyphSize = 32, wordmarkClassName = "", dark = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <DiamondGlyph size={glyphSize} title="ninthinning.email" />
      <Wordmark
        className={wordmarkClassName}
        periodColor={dark ? "#7fb295" : "#2d5a3d"}
      />
    </span>
  );
}
