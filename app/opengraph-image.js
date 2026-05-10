import { ImageResponse } from "next/og";

export const alt =
  "Ninth Inning Email — Spoiler-free MLB recaps in your inbox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Inline SVG glyph (diamond / four bases) per brand sheet v1.0.
function GlyphSvg({ size: s = 140 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 100 100" style={{ display: "block" }}>
      <rect width="100" height="100" rx="22" fill="#2d5a3d" />
      <rect
        x="50"
        y="14"
        width="50.91"
        height="50.91"
        transform="rotate(45 50 14)"
        fill="none"
        stroke="#f7f5ef"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="86" r="4.5" fill="#b8312f" />
      <circle cx="14" cy="50" r="3.2" fill="#f7f5ef" />
      <circle cx="86" cy="50" r="3.2" fill="#f7f5ef" />
      <circle cx="50" cy="14" r="3.2" fill="#f7f5ef" />
    </svg>
  );
}

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background:
            "radial-gradient(ellipse 80% 60% at 30% 0%, #2d5a3d 0%, #0f1311 60%)",
          color: "#f7f5ef",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            fontSize: "32px",
            fontWeight: 500,
            color: "#f7f5ef",
            letterSpacing: "-0.015em",
          }}
        >
          <GlyphSvg size={88} />
          <div style={{ display: "flex", alignItems: "center" }}>
            <span>ninthinning</span>
            <span
              style={{
                display: "block",
                width: 14,
                height: 14,
                background: "#7fb295",
                transform: "rotate(45deg)",
                margin: "0 14px",
              }}
            />
            <span>email</span>
          </div>
        </div>
        <div
          style={{
            marginTop: "48px",
            fontSize: "84px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#f7f5ef",
            maxWidth: "1000px",
          }}
        >
          Spoiler-free MLB recaps in your inbox.
        </div>
        <div
          style={{
            marginTop: "32px",
            fontSize: "32px",
            color: "#a8a299",
            maxWidth: "900px",
          }}
        >
          Pick your teams. We email the recap. No scores, no spoilers.
        </div>
      </div>
    ),
    { ...size }
  );
}
