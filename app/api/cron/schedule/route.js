import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runScheduler } from "@/lib/cron-jobs";

export const maxDuration = 30;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { status, body } = await runScheduler({ supabase });
  return NextResponse.json(body, { status });
}
