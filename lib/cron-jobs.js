import { TEAMS_BY_ID } from "@/lib/teams";
import {
  fetchSchedule,
  extractFinalGames,
  fetchGameContent,
  extractHighlightUrl,
  getDatesToCheck,
  formatDisplayDate,
  fetchDailySchedule,
  extractScheduledGames,
  computeExpectedFinish,
  getEtTodayDate,
} from "@/lib/mlb";
import { buildEmailHtml } from "@/lib/email-template";
import { sendEmail } from "@/lib/brevo";

// Polling window relative to a game's expected_finish_at (#76). Asymmetric:
// start 30m before, keep going for 2.5h after.
const EARLY_BOUND_MS = 30 * 60 * 1000;
const LATE_BOUND_MS = 2.5 * 60 * 60 * 1000;

const STALE_WAKE_HOURS = 36;

function isInMlbSeason() {
  const month = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
    }).format(new Date()),
    10
  );
  return month >= 4 && month <= 10;
}

async function startRun(supabase, status) {
  const { data, error } = await supabase
    .from("mlb_cron_runs")
    .insert({ status })
    .select("id")
    .single();
  if (error) {
    console.error("Failed to insert mlb_cron_runs row:", error.message);
    return null;
  }
  return data.id;
}

async function finalizeRun(
  supabase,
  runId,
  status,
  { gamesProcessed = 0, emailsSent = 0, errors = [] } = {}
) {
  if (!runId) return;
  const { error } = await supabase
    .from("mlb_cron_runs")
    .update({
      finished_at: new Date().toISOString(),
      status,
      games_processed: gamesProcessed,
      emails_sent: emailsSent,
      errors_count: errors.length,
      errors: errors.length > 0 ? errors : null,
    })
    .eq("id", runId);
  if (error) {
    console.error("Failed to finalize mlb_cron_runs row:", error.message);
  }
}

// Runs the same logic as GET /api/cron — auth is the caller's responsibility.
// Returns { status, body } where status is an HTTP status hint and body is the
// JSON-able payload to render.
export async function runMainCron({ supabase, emailsPaused = false } = {}) {
  if (emailsPaused) {
    const pausedRunId = await startRun(supabase, "running");
    await finalizeRun(supabase, pausedRunId, "paused");
    return { status: 200, body: { message: "Emails paused via kill switch" } };
  }

  const now = Date.now();
  const windowStart = new Date(now - LATE_BOUND_MS).toISOString();
  const windowEnd = new Date(now + EARLY_BOUND_MS).toISOString();
  const { data: activeWakes, error: scheduleError } = await supabase
    .from("mlb_cron_schedule")
    .select("game_pk")
    .gte("expected_finish_at", windowStart)
    .lte("expected_finish_at", windowEnd)
    .limit(1);

  if (scheduleError) {
    console.error("mlb_cron_schedule read failed, falling through:", scheduleError.message);
  } else if (!activeWakes || activeWakes.length === 0) {
    const { data: anyRows, error: anyRowsError } = await supabase
      .from("mlb_cron_schedule")
      .select("game_pk")
      .limit(1);

    if (anyRowsError) {
      console.error(
        "mlb_cron_schedule emptiness check failed, falling through:",
        anyRowsError.message
      );
    } else if ((!anyRows || anyRows.length === 0) && isInMlbSeason()) {
      console.warn(
        "mlb_cron_schedule is empty during MLB season — scheduler may be down, falling through to full check (#109)"
      );
    } else {
      const heartbeatRunId = await startRun(supabase, "running");
      await finalizeRun(supabase, heartbeatRunId, "skipped_no_wake");
      return {
        status: 200,
        body: { message: "No scheduled wake within window — skipped" },
      };
    }
  }

  const runId = await startRun(supabase, "running");
  const errors = [];

  try {
    const dates = getDatesToCheck();

    const { data: subscribedTeams } = await supabase
      .from("mlb_user_teams")
      .select("team_id")
      .limit(1000);

    const teamIds = [...new Set((subscribedTeams || []).map((r) => r.team_id))];

    if (teamIds.length === 0) {
      await finalizeRun(supabase, runId, "no_subscribers", { errors });
      return { status: 200, body: { message: "No subscribed teams" } };
    }

    console.log(`Checking ${teamIds.length} teams across dates: ${dates.join(", ")}`);

    const newGames = [];

    for (const teamId of teamIds) {
      for (const dateStr of dates) {
        try {
          const schedule = await fetchSchedule(teamId, dateStr);
          const finals = extractFinalGames(schedule);

          for (const game of finals) {
            const { data: cached } = await supabase
              .from("mlb_game_cache")
              .select("highlight_url")
              .eq("game_pk", game.gamePk)
              .single();

            if (cached?.highlight_url) {
              newGames.push({
                gamePk: game.gamePk,
                teamId,
                gameDate: dateStr,
                highlightUrl: cached.highlight_url,
              });
              continue;
            }

            const content = await fetchGameContent(game.gamePk);
            const url = extractHighlightUrl(content);

            await supabase.from("mlb_game_cache").upsert({
              game_pk: game.gamePk,
              team_id: teamId,
              game_date: dateStr,
              status: "final",
              highlight_url: url,
              checked_at: new Date().toISOString(),
            });

            if (url) {
              newGames.push({
                gamePk: game.gamePk,
                teamId,
                gameDate: dateStr,
                highlightUrl: url,
              });
            } else {
              const contentKeys = Object.keys(content || {}).join(", ");
              const hasHighlights = !!content?.highlights?.highlights?.items?.length;
              const hasEpg = !!content?.media?.epg?.length;
              console.log(
                `No highlight for game ${game.gamePk} (team ${teamId}, date ${dateStr}). ` +
                  `Content keys: [${contentKeys}], hasLegacyHighlights: ${hasHighlights}, hasEpg: ${hasEpg}`
              );
            }
          }
        } catch (err) {
          const errMsg = `Error checking team ${teamId} on ${dateStr}: ${err.message}`;
          console.error(errMsg);
          errors.push(errMsg);
        }
      }
    }

    if (newGames.length === 0) {
      await finalizeRun(supabase, runId, errors.length > 0 ? "partial" : "no_new_highlights", {
        errors,
      });
      return {
        status: 200,
        body: {
          message: "No new highlights available",
          errors: errors.length > 0 ? errors : undefined,
        },
      };
    }

    let emailsSent = 0;
    const skipped = [];

    for (const game of newGames) {
      const { data: subscribers } = await supabase
        .from("mlb_user_teams")
        .select("user_id")
        .eq("team_id", game.teamId);

      if (!subscribers?.length) {
        skipped.push({ gamePk: game.gamePk, reason: "no_subscribers" });
        continue;
      }

      for (const row of subscribers) {
        const userId = row.user_id;

        const { data: userData } = await supabase
          .from("mlb_users")
          .select("email")
          .eq("id", userId)
          .single();

        const email = userData?.email;
        if (!email) {
          skipped.push({ gamePk: game.gamePk, userId, reason: "no_email" });
          continue;
        }

        const { data: existing } = await supabase
          .from("mlb_sent_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("game_pk", game.gamePk)
          .maybeSingle();

        if (existing) {
          skipped.push({ gamePk: game.gamePk, reason: "already_notified" });
          continue;
        }

        const team = TEAMS_BY_ID[game.teamId];
        const teamName = team?.name || `Team ${game.teamId}`;
        const subject = `${teamName} Highlights — ${formatDisplayDate(game.gameDate)}`;
        const html = buildEmailHtml(team, game.highlightUrl, userId, game.gameDate);

        try {
          await sendEmail(email, subject, html);

          await supabase.from("mlb_sent_notifications").insert({
            user_id: userId,
            game_pk: game.gamePk,
          });

          emailsSent++;
        } catch (err) {
          const errMsg = `Failed to email ${email} for game ${game.gamePk}: ${err.message}`;
          console.error(errMsg);
          errors.push(errMsg);
        }
      }
    }

    await finalizeRun(supabase, runId, errors.length > 0 ? "partial" : "success", {
      gamesProcessed: newGames.length,
      emailsSent,
      errors,
    });

    return {
      status: 200,
      body: {
        message: `Processed ${newGames.length} games, sent ${emailsSent} emails`,
        errors: errors.length > 0 ? errors : undefined,
        skipped: skipped.length > 0 ? skipped : undefined,
      },
    };
  } catch (err) {
    const errMsg = `Cron run failed: ${err.message}`;
    console.error(errMsg, err);
    errors.push(errMsg);
    await finalizeRun(supabase, runId, "failure", { errors });
    return { status: 500, body: { error: errMsg } };
  }
}

// Runs the same logic as GET /api/cron/schedule — auth is the caller's responsibility.
export async function runScheduler({ supabase } = {}) {
  const runId = await startRun(supabase, "schedule_running");
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

    return {
      status: 200,
      body: {
        message: `Scheduled ${rows.length} wakes for ${dateStr}`,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (err) {
    const errMsg = `Scheduler run failed: ${err.message}`;
    console.error(errMsg, err);
    errors.push(errMsg);
    await finalizeRun(supabase, runId, "schedule_failure", { errors });
    return { status: 500, body: { error: errMsg } };
  }
}
