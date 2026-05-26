import { createClient } from "@/lib/supabase-server";
import { TEAMS_BY_SLUG } from "@/lib/teams";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function getEnv() {
  try {
    const mod = await import("@opennextjs/cloudflare");
    return mod.getCloudflareContext().env ?? {};
  } catch {
    return {};
  }
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email =
    typeof payload?.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const env = await getEnv();
  const ip = getClientIp(request);

  if (env.LOGIN_IP_LIMITER) {
    const { success } = await env.LOGIN_IP_LIMITER.limit({ key: `ip:${ip}` });
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  if (env.LOGIN_EMAIL_LIMITER) {
    const { success } = await env.LOGIN_EMAIL_LIMITER.limit({
      key: `email:${email}`,
    });
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  const supabase = await createClient();

  const origin = process.env.SITE_URL || new URL(request.url).origin;

  // Team-landing CTAs (#195) pass a team slug so the dashboard can pre-select
  // it on first load. Validate against the slug table — anything unknown is
  // silently dropped rather than reflected back into the redirect URL.
  const teamSlug =
    typeof payload?.team === "string" && TEAMS_BY_SLUG[payload.team]
      ? payload.team
      : null;
  const callbackUrl = new URL(`${origin}/auth/callback`);
  if (teamSlug) callbackUrl.searchParams.set("team", teamSlug);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl.toString() },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not send magic link" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
