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

export const maxDuration = 60;

export async function GET(request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const dates = getDatesToCheck();

  // 1. Get all team IDs that at least one user follows
  const { data: subscribedTeams } = await supabase
    .from("mlb_user_teams")
    .select("team_id")
    .limit(1000);

  const teamIds = [...new Set((subscribedTeams || []).map((r) => r.team_id))];

  if (teamIds.length === 0) {
    return NextResponse.json({ message: "No subscribed teams" });
  }

  console.log(`Checking ${teamIds.length} teams across ${dates.length} dates`);

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
            console.log(`No highlight yet for game ${game.gamePk} (team ${teamId})`);
          }
        }
      } catch (err) {
        console.error(`Error checking team ${teamId} on ${dateStr}:`, err.message);
      }
    }
  }

  if (newGames.length === 0) {
    return NextResponse.json({ message: "No new highlights available" });
  }

  // 3. For each game with highlights, find users to notify
  let emailsSent = 0;
  const debug = [];

  for (const game of newGames) {
    // Get users following this team
    const { data: subscribers, error: subError } = await supabase
      .from("mlb_user_teams")
      .select("user_id")
      .eq("team_id", game.teamId);

    debug.push({ step: "subscribers", teamId: game.teamId, count: subscribers?.length, error: subError });
    if (!subscribers?.length) continue;

    for (const row of subscribers) {
      const userId = row.user_id;

      // Look up email from auth.users via the mlb_users view
      const { data: userData, error: userError } = await supabase
        .from("mlb_users")
        .select("email")
        .eq("id", userId)
        .single();

      debug.push({ step: "userLookup", userId, email: userData?.email, error: userError });

      const email = userData?.email;
      if (!email) continue;

      // Check if already notified
      const { data: existing, error: notifError } = await supabase
        .from("mlb_sent_notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("game_pk", game.gamePk)
        .single();

      debug.push({ step: "notificationCheck", userId, gamePk: game.gamePk, existing: !!existing, error: notifError });
      if (existing) continue;

      // Send email
      const team = TEAMS_BY_ID[game.teamId];
      const teamName = team?.name || `Team ${game.teamId}`;
      const subject = `${teamName} Highlights \u2014 ${formatDisplayDate(game.gameDate)}`;
      const html = buildEmailHtml(teamName, game.highlightUrl, userId);

      try {
        await sendEmail(email, subject, html);

        await supabase.from("mlb_sent_notifications").insert({
          user_id: userId,
          game_pk: game.gamePk,
        });

        emailsSent++;
        debug.push({ step: "emailSent", email, gamePk: game.gamePk });
      } catch (err) {
        debug.push({ step: "emailFailed", email, gamePk: game.gamePk, error: err.message });
      }
    }
  }

  return NextResponse.json({
    message: `Processed ${newGames.length} games, sent ${emailsSent} emails`,
    debug,
  });
}

function buildEmailHtml(teamName, highlightUrl, userId) {
  const unsubscribeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com"}/unsubscribe?token=${userId}`;

  return `
<p>${teamName} highlights are ready.</p>
<p><a href="${highlightUrl}">Watch highlights</a></p>
<hr style="margin-top:32px;border:none;border-top:1px solid #333">
<p style="font-size:12px;color:#888">
  <a href="${unsubscribeUrl}" style="color:#888">Unsubscribe</a>
</p>`.trim();
}

async function sendEmail(to, subject, html) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.EMAIL_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 200)}`);
  }
}
