import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runMainCron } from "@/lib/cron-jobs";

export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { status, body } = await runMainCron({
    supabase,
    emailsPaused: process.env.EMAILS_PAUSED === "true",
  });
  return NextResponse.json(body, { status });
}
