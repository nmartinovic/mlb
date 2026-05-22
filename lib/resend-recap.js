import { TEAMS_BY_ID } from "@/lib/teams";
import {
  fetchStandings,
  extractTeamStanding,
  formatDisplayDate,
} from "@/lib/mlb";
import { buildEmailHtml } from "@/lib/email-template";
import { sendEmail } from "@/lib/brevo";

function previousDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Re-render and re-send the admin's most recent recap. Used by the /admin
// break-glass "Resend latest recap to me" button (issue #150) to QA template
// changes in a real inbox without waiting for a real game.
//
// Lookup order:
//   1. Latest mlb_sent_notifications row for adminUserId (excluding the
//      welcome sentinel, game_pk = 0), joined to mlb_game_cache.
//   2. Fallback: latest mlb_game_cache row that has a highlight_url, regardless
//      of whether the admin was subscribed.
//
// Does NOT write to mlb_sent_notifications — this is a test send. Subject is
// prefixed `[TEST]` so it's obvious in the inbox.
export async function resendLatestRecap({
  supabase,
  adminUserId,
  adminEmail,
  sendImpl = sendEmail,
  fetchStandingsImpl = fetchStandings,
}) {
  let gamePk = null;
  let teamId = null;
  let gameDate = null;
  let highlightUrl = null;
  let source = null;

  const { data: latestSent, error: sentErr } = await supabase
    .from("mlb_sent_notifications")
    .select("game_pk, sent_at")
    .eq("user_id", adminUserId)
    .gt("game_pk", 0)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sentErr) {
    throw new Error(`Failed to read mlb_sent_notifications: ${sentErr.message}`);
  }

  if (latestSent?.game_pk) {
    const { data: cache, error: cacheErr } = await supabase
      .from("mlb_game_cache")
      .select("game_pk, team_id, game_date, highlight_url")
      .eq("game_pk", latestSent.game_pk)
      .maybeSingle();
    if (cacheErr) {
      throw new Error(`Failed to read mlb_game_cache: ${cacheErr.message}`);
    }
    if (cache?.highlight_url) {
      gamePk = cache.game_pk;
      teamId = cache.team_id;
      gameDate = cache.game_date;
      highlightUrl = cache.highlight_url;
      source = "sent_notifications";
    }
  }

  if (!highlightUrl) {
    const { data: cache, error: cacheErr } = await supabase
      .from("mlb_game_cache")
      .select("game_pk, team_id, game_date, highlight_url")
      .not("highlight_url", "is", null)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cacheErr) {
      throw new Error(`Failed to read mlb_game_cache: ${cacheErr.message}`);
    }
    if (cache?.highlight_url) {
      gamePk = cache.game_pk;
      teamId = cache.team_id;
      gameDate = cache.game_date;
      highlightUrl = cache.highlight_url;
      source = "game_cache_fallback";
    }
  }

  if (!highlightUrl) {
    return { ok: false, reason: "no_recaps_found" };
  }

  let standing = null;
  try {
    const standings = await fetchStandingsImpl(previousDateStr(gameDate));
    standing = extractTeamStanding(standings, teamId);
  } catch (err) {
    console.warn(
      `resend-recap: standings fetch failed for ${gameDate} (continuing without):`,
      err.message
    );
  }

  const team = TEAMS_BY_ID[teamId];
  const teamName = team?.name || `Team ${teamId}`;
  const subject = `[TEST] ${teamName} Highlights — ${formatDisplayDate(gameDate)}`;
  const html = buildEmailHtml(team, highlightUrl, adminUserId, gameDate, standing, {
    gamePk,
  });

  await sendImpl(adminEmail, subject, html);

  return { ok: true, gamePk, teamId, gameDate, source };
}
