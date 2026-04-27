import { ImageResponse } from "next/og";

export const alt =
  "Ninth Inning Email — Spoiler-free MLB recaps in your inbox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
            "radial-gradient(ellipse 80% 60% at 30% 0%, #0f5132 0%, #0a1410 60%)",
          color: "#f5f1e6",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: "28px",
            fontWeight: 600,
            color: "#a8a299",
            letterSpacing: "0.02em",
          }}
        >
          <div style={{ display: "flex", gap: "10px" }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#c41e3a",
              }}
            />
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#f5f1e6",
              }}
            />
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#c41e3a",
              }}
            />
          </div>
          <span>Ninth Inning Email</span>
        </div>
        <div
          style={{
            marginTop: "40px",
            fontSize: "84px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#f5f1e6",
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
