"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runMainCron, runScheduler } from "@/lib/cron-jobs";
import { resendLatestRecap } from "@/lib/resend-recap";

// Defense-in-depth: re-check the admin email server-side. Page-level
// notFound() only hides UI; a non-admin who guesses the action endpoint
// must still be rejected here. Issue #110.
async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in" };
  }
  if (!process.env.ADMIN_EMAIL || user.email !== process.env.ADMIN_EMAIL) {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true, user };
}

export async function runSchedulerAction(_prevState, _formData) {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return { ok: false, message: auth.error, ranAt: new Date().toISOString() };
  }

  const supabase = createAdminClient();
  const { status, body } = await runScheduler({ supabase });
  return {
    ok: status < 400,
    message: body.message || body.error || "ran",
    errors: body.errors,
    ranAt: new Date().toISOString(),
  };
}

export async function runMainCronAction(_prevState, _formData) {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return { ok: false, message: auth.error, ranAt: new Date().toISOString() };
  }

  const supabase = createAdminClient();
  const { status, body } = await runMainCron({
    supabase,
    emailsPaused: process.env.EMAILS_PAUSED === "true",
  });
  return {
    ok: status < 400,
    message: body.message || body.error || "ran",
    errors: body.errors,
    ranAt: new Date().toISOString(),
  };
}

// Catch-up path (#154): bypasses the wake-window gate and forces a full
// check + send. Use when an earlier tick was killed mid-run and missed
// emails — `mlb_sent_notifications` dedupes, so already-sent users are skipped.
export async function forceRunMainCronAction(_prevState, _formData) {
  const auth = await assertAdmin();
  if (!auth.ok) {
    return { ok: false, message: auth.error, ranAt: new Date().toISOString() };
  }

  const supabase = createAdminClient();
  const { status, body } = await runMainCron({
    supabase,
    emailsPaused: process.env.EMAILS_PAUSED === "true",
    force: true,
  });
  return {
    ok: status < 400,
    message: body.message || body.error || "ran",
    errors: body.errors,
    ranAt: new Date().toISOString(),
  };
}

export async function resendLatestRecapAction(_prevState, _formData) {
  const ranAt = new Date().toISOString();
  const auth = await assertAdmin();
  if (!auth.ok) {
    return { ok: false, message: auth.error, ranAt };
  }

  if (process.env.EMAILS_PAUSED === "true") {
    return {
      ok: false,
      message: "Emails paused via kill switch",
      ranAt,
    };
  }

  const supabase = createAdminClient();
  try {
    const result = await resendLatestRecap({
      supabase,
      adminUserId: auth.user.id,
      adminEmail: auth.user.email,
    });
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "no_recaps_found"
            ? "No recaps found to resend"
            : result.reason || "Resend failed",
        ranAt,
      };
    }
    return {
      ok: true,
      message: `Resent recap for game ${result.gamePk} (${result.gameDate}) to ${auth.user.email}`,
      ranAt,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Resend failed: ${err.message}`,
      ranAt,
    };
  }
}
