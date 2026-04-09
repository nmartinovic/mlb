import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { TEAMS_BY_ID } from "@/lib/teams";
import {
  fetchSchedule,
  extractFinalGames,
  fetchGameContent,
  extractHighlightUrl,
  extractThumbnailUrl,
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
            // Already have the highlight — fetch content for thumbnail
            let thumbnail = null;
            try {
              const content = await fetchGameContent(game.gamePk);
              thumbnail = extractThumbnailUrl(content);
            } catch (_) {}
            newGames.push({
              gamePk: game.gamePk,
              teamId,
              gameDate: dateStr,
              highlightUrl: cached.highlight_url,
              thumbnailUrl: thumbnail,
            });
            continue;
          }

          // Try to extract highlight URL and thumbnail
          const content = await fetchGameContent(game.gamePk);
          const url = extractHighlightUrl(content);
          const thumbnail = extractThumbnailUrl(content);

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
              thumbnailUrl: thumbnail,
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
        console.error(`Error checking team ${teamId} on ${dateStr}:`, err.message);
      }
    }
  }

  if (newGames.length === 0) {
    return NextResponse.json({ message: "No new highlights available" });
  }

  // 3. For each game with highlights, find users to notify
  let emailsSent = 0;
  const errors = [];
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
      const subject = `${teamName} Highlights \u2014 ${formatDisplayDate(game.gameDate)}`;
      const html = buildEmailHtml(team, game.highlightUrl, userId, game.gameDate, game.thumbnailUrl);

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

  return NextResponse.json({
    message: `Processed ${newGames.length} games, sent ${emailsSent} emails`,
    errors: errors.length > 0 ? errors : undefined,
    skipped: skipped.length > 0 ? skipped : undefined,
  });
}

function buildEmailHtml(team, highlightUrl, userId, gameDate, thumbnailUrl) {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com";
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${userId}`;
  const teamName = team?.name || "Your team";
  const teamColor = team?.color || "#2563eb";
  const teamAbbr = team?.abbr || "";
  const displayDate = formatDisplayDate(gameDate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${teamName} Highlights</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

  <!-- Team color accent bar -->
  <tr><td style="height:6px;background-color:${teamColor};"></td></tr>

  <!-- Header -->
  <tr><td style="padding:28px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span style="display:inline-block;background-color:${teamColor};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;border-radius:4px;">${teamAbbr}</span>
        </td>
        <td align="right" style="color:#71717a;font-size:13px;">${displayDate}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:20px 32px 0 32px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">${teamName} highlights are ready</h1>
    <p style="margin:8px 0 0 0;font-size:15px;color:#52525b;line-height:1.5;">Your spoiler-free game recap is waiting for you.</p>
  </td></tr>

  <!-- Thumbnail + play button overlay -->
  ${thumbnailUrl ? `<tr><td style="padding:24px 32px 0 32px;">
    <a href="${highlightUrl}" style="display:block;text-decoration:none;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;">
        <tr><td background="${thumbnailUrl}" bgcolor="#18181b" width="100%" height="256" valign="middle" style="background-size:cover;background-position:center;border-radius:8px;">
          <!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:456px;height:256px;"><v:fill type="frame" src="${thumbnailUrl}"/><v:textbox inset="0,0,0,0"><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" height="256"><tr><td align="center" valign="middle">
            <div style="width:56px;height:56px;border-radius:50%;background-color:rgba(0,0,0,0.6);line-height:56px;text-align:center;">
              <span style="font-size:24px;color:#ffffff;margin-left:3px;">&#9654;</span>
            </div>
          </td></tr></table>
          <!--[if gte mso 9]></v:textbox></v:rect><![endif]-->
        </td></tr>
      </table>
    </a>
  </td></tr>` : ""}

  <!-- CTA Button -->
  <tr><td style="padding:24px 32px 0 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">
        <a href="${highlightUrl}" style="display:inline-block;background-color:${teamColor};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Watch Highlights &#9654;</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer divider -->
  <tr><td style="padding:32px 32px 0 32px;">
    <hr style="margin:0;border:none;border-top:1px solid #e4e4e7;">
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px 28px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#a1a1aa;">
          <strong style="color:#52525b;">Highlight Reel</strong><br>
          Spoiler-free MLB recaps
        </td>
        <td align="right" style="font-size:12px;">
          <a href="${unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
        </td>
      </tr>
    </table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
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
