import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { TEAMS_BY_ID } from "@/lib/teams";
import {
  fetchSchedule,
  extractFinalGames,
  fetchGameContent,
  extractHighlightUrl,
  getDatesToCheck,
  formatDisplayDate,
} from "@/lib/mlb";
import { buildEmailHtml } from "@/lib/email-template";
import { sendEmail } from "@/lib/brevo";

export const maxDuration = 60;

async function startRun(supabase) {
  const { data, error } = await supabase
    .from("mlb_cron_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (error) {
    console.error("Failed to insert mlb_cron_runs row:", error.message);
    return null;
  }
  return data.id;
}

async function finalizeRun(supabase, runId, status, { gamesProcessed = 0, emailsSent = 0, errors = [] } = {}) {
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

export async function GET(request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Kill switch: set EMAILS_PAUSED=true in Cloudflare dashboard to halt all sends instantly
  if (process.env.EMAILS_PAUSED === "true") {
    const pausedRunId = await startRun(supabase);
    await finalizeRun(supabase, pausedRunId, "paused");
    return NextResponse.json({ message: "Emails paused via kill switch" });
  }

  const runId = await startRun(supabase);
  const errors = [];

  try {
    const dates = getDatesToCheck();

    // 1. Get all team IDs that at least one user follows
    const { data: subscribedTeams } = await supabase
      .from("mlb_user_teams")
      .select("team_id")
      .limit(1000);

    const teamIds = [...new Set((subscribedTeams || []).map((r) => r.team_id))];

    if (teamIds.length === 0) {
      await finalizeRun(supabase, runId, "no_subscribers", { errors });
      return NextResponse.json({ message: "No subscribed teams" });
    }

    console.log(`Checking ${teamIds.length} teams across dates: ${dates.join(", ")}`);

    // 2. For each team, fetch schedule and find final games
    const newGames = [];

    for (const teamId of teamIds) {
      for (const dateStr of dates) {
        try {
          const schedule = await fetchSchedule(teamId, dateStr);
          const finals = extractFinalGames(schedule);

          for (const game of finals) {
            // Check if we already have this game cached with a highlight URL
            const { data: cached } = await supabase
              .from("mlb_game_cache")
              .select("highlight_url")
              .eq("game_pk", game.gamePk)
              .single();

            if (cached?.highlight_url) {
              // Already have the highlight — just need to check for unsent notifications
              newGames.push({
                gamePk: game.gamePk,
                teamId,
                gameDate: dateStr,
                highlightUrl: cached.highlight_url,
              });
              continue;
            }

            // Try to extract highlight URL
            const content = await fetchGameContent(game.gamePk);
            const url = extractHighlightUrl(content);

            // Upsert into game_cache
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
      await finalizeRun(supabase, runId, errors.length > 0 ? "partial" : "no_new_highlights", { errors });
      return NextResponse.json({
        message: "No new highlights available",
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    // 3. For each game with highlights, find users to notify
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

        // Check if already notified
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

        // Send email
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

    return NextResponse.json({
      message: `Processed ${newGames.length} games, sent ${emailsSent} emails`,
      errors: errors.length > 0 ? errors : undefined,
      skipped: skipped.length > 0 ? skipped : undefined,
    });
  } catch (err) {
    const errMsg = `Cron run failed: ${err.message}`;
    console.error(errMsg, err);
    errors.push(errMsg);
    await finalizeRun(supabase, runId, "failure", { errors });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
