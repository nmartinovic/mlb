import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runMainCron } from "@/lib/cron-jobs";
import { cronRanRecently } from "@/lib/cron-backup";

export const maxDuration = 60;

// The GitHub Actions backup cron calls this with ?backup=1. It only runs the
// real job when Cloudflare's own cron looks dead — no mlb_cron_runs row in the
// last BACKUP_STALE_MS. That keeps Cloudflare's scheduler primary; while it is
// healthy the backup is a no-op. See .github/workflows/cron-backup.yml.
const BACKUP_STALE_MS = 25 * 60 * 1000;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (new URL(request.url).searchParams.get("backup") === "1") {
    if (await cronRanRecently(supabase, { maxAgeMs: BACKUP_STALE_MS })) {
      return NextResponse.json({
        message: "Backup skipped — Cloudflare cron is healthy",
      });
    }
  }

  const { status, body } = await runMainCron({
    supabase,
    emailsPaused: process.env.EMAILS_PAUSED === "true",
  });
  return NextResponse.json(body, { status });
}
