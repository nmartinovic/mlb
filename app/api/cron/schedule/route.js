import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  fetchDailySchedule,
  extractScheduledGames,
  computeExpectedFinish,
  getEtTodayDate,
} from "@/lib/mlb";

export const maxDuration = 30;

// Drop wakes whose expected_finish_at is more than this far in the past. Two
// MLB regular-season days covers suspended games we still want to revisit; the
// main cron's polling window cuts off at now-2.5h regardless, so older rows are
// pure clutter.
const STALE_WAKE_HOURS = 36;

async function startRun(supabase) {
  const { data, error } = await supabase
    .from("mlb_cron_runs")
    .insert({ status: "schedule_running" })
    .select("id")
    .single();
  if (error) {
    console.error("Failed to insert mlb_cron_runs row:", error.message);
    return null;
  }
  return data.id;
}

async function finalizeRun(supabase, runId, status, { gamesProcessed = 0, errors = [] } = {}) {
  if (!runId) return;
  const { error } = await supabase
    .from("mlb_cron_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      games_processed: gamesProcessed,
      emails_sent: 0,
      errors_count: errors.length,
      errors: errors.length > 0 ? errors : null,
    })
    .eq("id", runId);
  if (error) {
    console.error("Failed to finalize mlb_cron_runs row:", error.message);
  }
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const runId = await startRun(supabase);
  const errors = [];

  try {
    const dateStr = getEtTodayDate();
    const schedule = await fetchDailySchedule(dateStr);
    const games = extractScheduledGames(schedule);

    const rows = [];
    for (const game of games) {
      const expectedFinish = computeExpectedFinish(game.gameDate);
      if (!expectedFinish) continue;
      rows.push({
        game_pk: game.gamePk,
        expected_finish_at: expectedFinish.toISOString(),
        game_date: dateStr,
      });
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("mlb_cron_schedule")
        .upsert(rows, { onConflict: "game_pk" });
      if (upsertError) {
        errors.push(`Failed to upsert wakes: ${upsertError.message}`);
      }
    }

    const cutoff = new Date(Date.now() - STALE_WAKE_HOURS * 60 * 60 * 1000).toISOString();
    const { error: deleteError } = await supabase
      .from("mlb_cron_schedule")
      .delete()
      .lt("expected_finish_at", cutoff);
    if (deleteError) {
      errors.push(`Failed to prune stale wakes: ${deleteError.message}`);
    }

    const status = errors.length > 0 ? "schedule_partial" : "schedule_built";
    await finalizeRun(supabase, runId, status, { gamesProcessed: rows.length, errors });

    return NextResponse.json({
      message: `Scheduled ${rows.length} wakes for ${dateStr}`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const errMsg = `Scheduler run failed: ${err.message}`;
    console.error(errMsg, err);
    errors.push(errMsg);
    await finalizeRun(supabase, runId, "schedule_failure", { errors });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
