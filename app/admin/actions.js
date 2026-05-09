"use server";

import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runMainCron, runScheduler } from "@/lib/cron-jobs";

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
  return { ok: true };
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
