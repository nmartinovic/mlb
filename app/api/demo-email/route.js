import { NextResponse } from "next/server";
import { notFound } from "next/navigation";
import { buildEmailHtml } from "@/lib/email-template";
import { TEAMS_BY_ID } from "@/lib/teams";

// Demo-only route used by the product-demo recorder (scripts/demo/) to
// screenshot the rendered recap email. Gated to development so it does not
// ship to the Cloudflare worker — see issue #127.
export async function GET(request) {
  if (process.env.NODE_ENV === "production") notFound();
  const { searchParams } = new URL(request.url);
  const teamId = parseInt(searchParams.get("teamId") || "119");
  const team = TEAMS_BY_ID[teamId];
  const gameDate = new Date().toISOString().slice(0, 10);
  const html = buildEmailHtml(
    team,
    "https://www.mlb.com/video/recap",
    "demo-user",
    gameDate,
  );
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
