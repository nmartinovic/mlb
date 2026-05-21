import { TEAMS_BY_ID } from "@/lib/teams";
import {
  extractFinalGames,
  fetchGameContent,
  extractHighlightUrl,
  getDatesToCheck,
  formatDisplayDate,
  fetchDailySchedule,
  extractScheduledGames,
  computeExpectedFinish,
  getEtTodayDate,
  fetchStandings,
  extractTeamStanding,
  extractSeriesContext,
} from "@/lib/mlb";
import { buildEmailHtml } from "@/lib/email-template";
import { sendEmail } from "@/lib/brevo";

// Polling window relative to a game's expected_finish_at (#76). Asymmetric:
// start 30m before, keep going for 2.5h after.
const EARLY_BOUND_MS = 30 * 60 * 1000;
const LATE_BOUND_MS = 2.5 * 60 * 60 * 1000;

const STALE_WAKE_HOURS = 36;

// Defense-in-depth (#154): if a previous tick was killed by Cloudflare's
// wall-clock before reaching finalizeRun(), its row stays at "running"
// forever. Sweep anything older than this threshold to "failure" so the
// admin dashboard reflects reality. Threshold is well past the worker's
// HTTP wall-clock (~30s) but short enough that the next tick cleans up the
// previous one before SLO B2 (30m silence) trips.
const STALE_RUNNING_MS = 20 * 60 * 1000;

async function sweepStuckRuns(supabase) {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  const { data, error } = await supabase
    .from("mlb_cron_runs")
    .update({
      finished_at: new Date().toISOString(),
      status: "failure",
      errors: [
        "Run did not reach finalizeRun — likely killed by Cloudflare wall-clock. Swept by sweepStuckRuns (#154).",
      ],
      errors_count: 1,
    })
    .in("status", ["running", "schedule_running"])
    .lt("started_at", cutoff)
    .select("id");
  if (error) {
    console.error("sweepStuckRuns failed:", error.message);
    return 0;
  }
  return data?.length || 0;
}

function previousDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

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
// `force: true` bypasses the wake-window gate and runs the full check
// regardless. Used by the /admin "Force run main cron (catch up)" button to
// resend emails that were missed while a previous tick was hung (#154).
// `env` is the Cloudflare Worker bindings, passed in only by the scheduled
// handler — its process.env bridge doesn't reach the bundled libs, so it has
// to thread Worker-side values explicitly (#163). HTTP callers omit it and
// the libs fall back to process.env (which OpenNext's fetch wrapper has
// populated by then).
// `dryRun: true` (#180) executes every real read path — Supabase reads, MLB
// API fetches, highlight extraction, email rendering — but skips the two
// irreversible side effects: the Brevo send and the mlb_sent_notifications
// dedup insert. The mlb_game_cache upsert still runs (safe write). The run is
// finalized with status "dry_run" and the body carries a `dryRunReport` array
// with one entry per would-be email. Safe to invoke at any time.
// Returns { status, body } where status is an HTTP status hint and body is the
// JSON-able payload to render.
export async function runMainCron({
  supabase,
  env,
  emailsPaused = false,
  force = false,
  dryRun = false,
} = {}) {
  const emailOpts = env
    ? { apiKey: env.EMAIL_API_KEY, fromEmail: env.FROM_EMAIL }
    : undefined;
  const templateOpts = env
    ? { siteUrl: env.SITE_URL, tipUrl: env.TIP_URL }
    : undefined;
  // Defense-in-depth: clean up any rows left "running" by a previous tick
  // that was killed mid-execution (#154). Runs on every invocation so the
  // dashboard stays accurate even in the no-wake path.
  await sweepStuckRuns(supabase);

  if (emailsPaused) {
    const pausedRunId = await startRun(supabase, "running");
    await finalizeRun(supabase, pausedRunId, "paused");
    return { status: 200, body: { message: "Emails paused via kill switch" } };
  }

  if (!force) {
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
  }

  const runId = await startRun(supabase, "running");
  const errors = [];
  const dryRunReport = [];

  try {
    const dates = getDatesToCheck();

    const { data: subscribedTeams } = await supabase
      .from("mlb_user_teams")
      .select("user_id, team_id")
      .limit(1000);

    // Group subscribers by team for the email fan-out below, so we don't
    // re-query mlb_user_teams once per new game.
    const subscribersByTeamId = new Map();
    for (const row of subscribedTeams || []) {
      if (!subscribersByTeamId.has(row.team_id)) {
        subscribersByTeamId.set(row.team_id, []);
      }
      subscribersByTeamId.get(row.team_id).push(row.user_id);
    }
    const teamIds = [...subscribersByTeamId.keys()];

    if (teamIds.length === 0) {
      await finalizeRun(supabase, runId, "no_subscribers", { errors });
      return {
        status: 200,
        body: { message: "No subscribed teams", ...(dryRun ? { dryRunReport } : {}) },
      };
    }

    console.log(`Checking ${teamIds.length} teams across dates: ${dates.join(", ")}`);

    // Fetch one schedule per date instead of one per (team × date). The MLB
    // Stats API returns all 30 teams' games for a date in a single call, so
    // we filter locally rather than spending a subrequest per team. This was
    // the dominant cause of "Too many subrequests by single Worker invocation"
    // errors on busy MLB days — 30 teams × 3 dates = 90 fetches just here.
    const teamIdSet = new Set(teamIds);
    const candidatesByGamePk = new Map();
    await Promise.all(
      dates.map(async (dateStr) => {
        try {
          const schedule = await fetchDailySchedule(dateStr);
          for (const game of extractFinalGames(schedule)) {
            const homeId = game.teams?.home?.team?.id;
            const awayId = game.teams?.away?.team?.id;
            const matchedTeamIds = [];
            if (teamIdSet.has(homeId)) matchedTeamIds.push(homeId);
            if (teamIdSet.has(awayId)) matchedTeamIds.push(awayId);
            if (matchedTeamIds.length === 0) continue;
            // A game can match for both home and away when both fanbases are
            // subscribed; key by gamePk so we only fetch/cache once. Keep the
            // schedule game payload around so the render loop can pull
            // spoiler-safe series context (#69) without re-fetching.
            candidatesByGamePk.set(game.gamePk, { dateStr, teamIds: matchedTeamIds, game });
          }
        } catch (err) {
          const errMsg = `Error fetching schedule for ${dateStr}: ${err.message}`;
          console.error(errMsg);
          errors.push(errMsg);
        }
      })
    );

    // Batch the cache lookup: one .in() query instead of one per final game.
    const candidateGamePks = [...candidatesByGamePk.keys()];
    const cachedHighlightByPk = new Map();
    if (candidateGamePks.length > 0) {
      const { data: cachedRows, error: cacheError } = await supabase
        .from("mlb_game_cache")
        .select("game_pk, highlight_url")
        .in("game_pk", candidateGamePks);
      if (cacheError) {
        console.error("mlb_game_cache batch read failed:", cacheError.message);
      } else {
        for (const row of cachedRows || []) {
          cachedHighlightByPk.set(row.game_pk, row.highlight_url);
        }
      }
    }

    const newGames = [];
    for (const [gamePk, { dateStr, teamIds: matchedTeamIds, game: scheduleGame }] of candidatesByGamePk) {
      let url;
      if (cachedHighlightByPk.get(gamePk)) {
        url = cachedHighlightByPk.get(gamePk);
      } else {
        try {
          const content = await fetchGameContent(gamePk);
          url = extractHighlightUrl(content);
          await supabase.from("mlb_game_cache").upsert({
            game_pk: gamePk,
            team_id: matchedTeamIds[0],
            game_date: dateStr,
            status: "final",
            highlight_url: url,
            checked_at: new Date().toISOString(),
          });
          if (!url) {
            const contentKeys = Object.keys(content || {}).join(", ");
            const hasHighlights = !!content?.highlights?.highlights?.items?.length;
            const hasEpg = !!content?.media?.epg?.length;
            console.log(
              `No highlight for game ${gamePk} (teams ${matchedTeamIds.join(",")}, date ${dateStr}). ` +
                `Content keys: [${contentKeys}], hasLegacyHighlights: ${hasHighlights}, hasEpg: ${hasEpg}`
            );
          }
        } catch (err) {
          const errMsg = `Error checking game ${gamePk} on ${dateStr}: ${err.message}`;
          console.error(errMsg);
          errors.push(errMsg);
          continue;
        }
      }

      if (!url) continue;
      for (const teamId of matchedTeamIds) {
        newGames.push({ gamePk, teamId, gameDate: dateStr, highlightUrl: url, scheduleGame });
      }
    }

    if (newGames.length === 0) {
      const noGamesStatus =
        errors.length > 0 ? (dryRun ? "dry_run" : "partial") : "no_new_highlights";
      await finalizeRun(supabase, runId, noGamesStatus, { errors });
      return {
        status: 200,
        body: {
          message: "No new highlights available",
          errors: errors.length > 0 ? errors : undefined,
          ...(dryRun ? { dryRunReport } : {}),
        },
      };
    }

    let emailsSent = 0;
    const skipped = [];

    // Spoiler-safe standings snapshot: for each unique game date, fetch the
    // standings as of the day before first pitch (issue #148). One MLB API
    // call per date covers all 30 teams for that date.
    const standingsByDate = new Map();
    const uniqueGameDates = [...new Set(newGames.map((g) => g.gameDate))];
    for (const dateStr of uniqueGameDates) {
      try {
        const snapshotDate = previousDateStr(dateStr);
        const standings = await fetchStandings(snapshotDate);
        standingsByDate.set(dateStr, standings);
      } catch (err) {
        console.warn(
          `Standings fetch failed for ${dateStr} (continuing without standings):`,
          err.message
        );
        standingsByDate.set(dateStr, null);
      }
    }

    // Batch the user-email and sent-notification lookups: one .in() query
    // each, instead of two queries per (game × subscriber). Without this, a
    // busy MLB day blows past Cloudflare's 1000-subrequest-per-invocation
    // budget before finalizeRun() can update mlb_cron_runs.
    const candidateUserIds = new Set();
    for (const game of newGames) {
      for (const userId of subscribersByTeamId.get(game.teamId) || []) {
        candidateUserIds.add(userId);
      }
    }
    const candidateUserIdList = [...candidateUserIds];

    const emailByUserId = new Map();
    if (candidateUserIdList.length > 0) {
      const { data: userRows, error: usersError } = await supabase
        .from("mlb_users")
        .select("id, email")
        .in("id", candidateUserIdList);
      if (usersError) {
        console.error("mlb_users batch read failed:", usersError.message);
      } else {
        for (const row of userRows || []) {
          if (row.email) emailByUserId.set(row.id, row.email);
        }
      }
    }

    const newGameGamePks = [...new Set(newGames.map((g) => g.gamePk))];
    const alreadySent = new Set();
    if (candidateUserIdList.length > 0 && newGameGamePks.length > 0) {
      const { data: sentRows, error: sentError } = await supabase
        .from("mlb_sent_notifications")
        .select("user_id, game_pk")
        .in("game_pk", newGameGamePks)
        .in("user_id", candidateUserIdList);
      if (sentError) {
        console.error("mlb_sent_notifications batch read failed:", sentError.message);
      } else {
        for (const row of sentRows || []) {
          alreadySent.add(`${row.user_id}:${row.game_pk}`);
        }
      }
    }

    // Recipients who have paused recap emails (#22). One batched query against
    // mlb_user_preferences; the .gt() filter excludes NULL and past timestamps
    // server-side, so only currently-paused users come back. On error we fall
    // open (send) rather than dropping everyone's email over a transient blip —
    // consistent with the schedule-read fall-open above.
    const pausedUserIds = new Set();
    if (candidateUserIdList.length > 0) {
      const { data: pausedRows, error: pausedError } = await supabase
        .from("mlb_user_preferences")
        .select("user_id")
        .in("user_id", candidateUserIdList)
        .gt("notifications_paused_until", new Date().toISOString());
      if (pausedError) {
        console.error("mlb_user_preferences batch read failed:", pausedError.message);
      } else {
        for (const row of pausedRows || []) {
          pausedUserIds.add(row.user_id);
        }
      }
    }

    for (const game of newGames) {
      const subscriberUserIds = subscribersByTeamId.get(game.teamId) || [];
      if (subscriberUserIds.length === 0) {
        skipped.push({ gamePk: game.gamePk, reason: "no_subscribers" });
        continue;
      }

      for (const userId of subscriberUserIds) {
        const email = emailByUserId.get(userId);
        if (!email) {
          skipped.push({ gamePk: game.gamePk, userId, reason: "no_email" });
          continue;
        }

        if (alreadySent.has(`${userId}:${game.gamePk}`)) {
          skipped.push({ gamePk: game.gamePk, reason: "already_notified" });
          continue;
        }

        if (pausedUserIds.has(userId)) {
          skipped.push({ gamePk: game.gamePk, userId, reason: "notifications_paused" });
          continue;
        }

        const team = TEAMS_BY_ID[game.teamId];
        const teamName = team?.name || `Team ${game.teamId}`;
        const subject = `${teamName} Highlights — ${formatDisplayDate(game.gameDate)}`;
        const standings = standingsByDate.get(game.gameDate);
        const standing = standings ? extractTeamStanding(standings, game.teamId) : null;
        const rawSeries = extractSeriesContext(game.scheduleGame, game.teamId);
        const opponent = rawSeries ? TEAMS_BY_ID[rawSeries.opponentId] : null;
        const seriesContext = opponent
          ? {
              opponentName: opponent.shortName,
              isHome: rawSeries.isHome,
              seriesGameNumber: rawSeries.seriesGameNumber,
              gamesInSeries: rawSeries.gamesInSeries,
            }
          : null;
        const html = buildEmailHtml(
          team,
          game.highlightUrl,
          userId,
          game.gameDate,
          standing,
          { ...(templateOpts || {}), seriesContext }
        );

        if (dryRun) {
          // Skip the two irreversible side effects — the Brevo send and the
          // mlb_sent_notifications dedup insert (#180). Everything above
          // (reads, cache upsert, render) already ran for real.
          console.log(`DRY RUN: would send to ${email} — "${subject}"`);
          dryRunReport.push({
            gamePk: game.gamePk,
            gameDate: game.gameDate,
            teamId: game.teamId,
            teamName,
            userId,
            email,
            subject,
            highlightUrl: game.highlightUrl,
            standing,
            seriesContext,
          });
          emailsSent++;
          continue;
        }

        try {
          await sendEmail(email, subject, html, emailOpts);

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

    const finalStatus = dryRun
      ? "dry_run"
      : errors.length > 0
        ? "partial"
        : "success";
    await finalizeRun(supabase, runId, finalStatus, {
      gamesProcessed: newGames.length,
      emailsSent,
      errors,
    });

    return {
      status: 200,
      body: {
        message: dryRun
          ? `DRY RUN: ${newGames.length} games processed, ${emailsSent} emails would be sent`
          : `Processed ${newGames.length} games, sent ${emailsSent} emails`,
        errors: errors.length > 0 ? errors : undefined,
        skipped: skipped.length > 0 ? skipped : undefined,
        ...(dryRun ? { dryRunReport } : {}),
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
