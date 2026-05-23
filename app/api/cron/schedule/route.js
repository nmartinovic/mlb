import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runScheduler } from "@/lib/cron-jobs";
import { cronRanRecently } from "@/lib/cron-backup";

export const maxDuration = 30;

// The GitHub Actions backup cron calls this with ?backup=1. The scheduler runs
// once a day, so the backup only runs it when no schedule_* row has landed in
// the last BACKUP_SCHEDULER_STALE_MS — i.e. Cloudflare missed today's tick.
const BACKUP_SCHEDULER_STALE_MS = 25 * 60 * 60 * 1000;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  if (new URL(request.url).searchParams.get("backup") === "1") {
    const recent = await cronRanRecently(supabase, {
      maxAgeMs: BACKUP_SCHEDULER_STALE_MS,
      statusPrefix: "schedule",
    });
    if (recent) {
      return NextResponse.json({
        message: "Backup skipped — scheduler ran recently",
      });
    }
  }

  const { status, body } = await runScheduler({ supabase });
  return NextResponse.json(body, { status });
}
