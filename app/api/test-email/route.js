import { NextResponse } from "next/server";
import { TEAMS_BY_ID } from "@/lib/teams";
import {
  fetchSchedule,
  extractFinalGames,
  fetchGameContent,
  extractHighlightUrl,
  extractThumbnailUrl,
  formatDisplayDate,
} from "@/lib/mlb";

export async function GET(request) {
  // Only allow with cron secret to prevent abuse
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to");
  const teamId = parseInt(searchParams.get("teamId") || "119"); // Default: Dodgers

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to)) {
    return NextResponse.json(
      { error: "Missing or invalid ?to=email@example.com" },
      { status: 400 }
    );
  }

  const team = TEAMS_BY_ID[teamId];
  const teamName = team?.name || `Team ${teamId}`;

  // Try to find a real recent game for this team to get a real thumbnail
  let highlightUrl = "https://www.mlb.com/video/search";
  let thumbnailUrl = null;
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  for (let daysBack = 0; daysBack < 7; daysBack++) {
    try {
      const dateStr = formatter.format(new Date(now.getTime() - daysBack * 86400000));
      const schedule = await fetchSchedule(teamId, dateStr);
      const finals = extractFinalGames(schedule);
      if (finals.length > 0) {
        const content = await fetchGameContent(finals[0].gamePk);
        const url = extractHighlightUrl(content);
        const thumb = extractThumbnailUrl(content);
        if (url) highlightUrl = url;
        if (thumb) thumbnailUrl = thumb;
        if (url || thumb) break;
      }
    } catch (_) {}
  }

  const gameDate = new Date().toISOString().slice(0, 10);
  const subject = `[TEST] ${teamName} Highlights — ${formatDisplayDate(gameDate)}`;
  const html = buildTestEmailHtml(team, highlightUrl, "test-user-id", gameDate, thumbnailUrl);

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
    return NextResponse.json(
      { error: `Brevo ${res.status}: ${body.slice(0, 300)}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: `Test email sent to ${to}`,
    team: teamName,
    thumbnailUrl,
    highlightUrl,
  });
}

function buildTestEmailHtml(team, highlightUrl, userId, gameDate, thumbnailUrl) {
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
