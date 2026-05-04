import { createClient } from "@supabase/supabase-js";
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const origin = process.env.SITE_URL || new URL(request.url).origin;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not send magic link" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
