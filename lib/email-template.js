import { formatDisplayDate } from "@/lib/mlb";

// Brand sheet v1.0 — diamond / four bases.
const BRAND_GREEN = "#2d5a3d";
const BRAND_PAPER = "#f7f5ef";
const BRAND_STITCH = "#b8312f";

// Wordmark fragment — "ninthinning" + a tiny solid diamond (◆) in ballpark
// green + "email". Uses Unicode rather than an SVG image because most email
// clients (Gmail in particular) strip inline SVG. The font stack mirrors the
// brand sheet (General Sans → Hanken Grotesk → system).
function brandWordmarkHtml({ size = 16, ink = "#1a1d1c", periodColor = BRAND_GREEN } = {}) {
  return `<span style="font-family:'General Sans','Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-weight:500;font-size:${size}px;letter-spacing:-0.015em;color:${ink};white-space:nowrap;">ninthinning<span style="color:${periodColor};margin:0 1px;">&#9670;</span>email</span>`;
}

function getSiteUrl() {
  return (
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://yourdomain.com"
  );
}

export function buildWelcomeEmailHtml(userId) {
  const siteUrl = getSiteUrl();
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${userId}`;
  const dashboardUrl = `${siteUrl}/dashboard`;
  const tipUrl = process.env.TIP_URL;
  const accent = BRAND_GREEN;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Ninth Inning Email</title>
</head>
<body style="margin:0;padding:0;background-color:#efece4;font-family:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece4;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${BRAND_PAPER};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">

  <!-- Brand accent bar -->
  <tr><td style="height:6px;background-color:${accent};"></td></tr>

  <!-- Wordmark -->
  <tr><td style="padding:24px 32px 0 32px;">
    ${brandWordmarkHtml({ size: 14 })}
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:14px 32px 0 32px;">
    <h1 style="margin:0;font-family:'General Sans','Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:24px;font-weight:600;color:#1a1d1c;line-height:1.3;letter-spacing:-0.02em;">You&#39;re in.</h1>
    <p style="margin:8px 0 0 0;font-size:15px;color:#52525b;line-height:1.5;">Your spoiler-free recaps start as soon as your team&#39;s next game wraps.</p>
  </td></tr>

  <!-- How it works -->
  <tr><td style="padding:24px 32px 0 32px;">
    <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;letter-spacing:0.5px;color:#71717a;text-transform:uppercase;">How it works</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#3f3f46;line-height:1.55;">
          &bull; Recaps land within a few hours of the final out &mdash; usually first thing the next morning.
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#3f3f46;line-height:1.55;">
          &bull; Subject lines and previews never reveal the score. Open when you&#39;re ready.
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:14px;color:#3f3f46;line-height:1.55;">
          &bull; One tap takes you to the official MLB.com highlight reel.
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA Button -->
  <tr><td style="padding:24px 32px 0 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:${accent};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Manage your teams</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer divider -->
  <tr><td style="padding:32px 32px 0 32px;">
    <hr style="margin:0;border:none;border-top:1px solid #e4e4e7;">
  </td></tr>

  ${tipUrl ? `
  <!-- Tip prompt -->
  <tr><td align="center" style="padding:18px 32px 0 32px;">
    <p style="margin:0;font-size:13px;color:#52525b;line-height:1.5;">
      Enjoying Ninth Inning Email? <a href="${tipUrl}" style="color:${accent};text-decoration:underline;font-weight:600;">Tip the developer</a> to keep it running.
    </p>
  </td></tr>
  ` : ""}

  <!-- Forward prompt -->
  <tr><td align="center" style="padding:12px 32px 0 32px;">
    <p style="margin:0;font-size:13px;color:#52525b;line-height:1.5;">
      Know a fan who&#39;d like this? Forward them this email or send them <a href="${siteUrl}" style="color:${accent};text-decoration:underline;font-weight:600;">ninthinning.email</a>.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#a1a1aa;">
          ${brandWordmarkHtml({ size: 13, ink: "#52525b" })}<br>
          <span style="font-size:12px;color:#a1a1aa;">Spoiler-free MLB recaps</span>
        </td>
        <td align="right" style="font-size:12px;vertical-align:top;">
          <a href="${unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Disclaimer -->
  <tr><td style="padding:12px 32px 28px 32px;">
    <p style="margin:0;font-size:11px;color:#a1a1aa;line-height:1.5;">Ninth Inning Email is not affiliated with, endorsed by, or sponsored by MLB or any MLB club. Questions or takedown requests: <a href="mailto:abuse@ninthinning.email" style="color:#a1a1aa;">abuse@ninthinning.email</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// Spoiler-safe standings strip (#148). `standing` is the snapshot from the day
// before first pitch, so the rendered numbers cannot reveal the result of the
// game being recapped. Returns an empty string when no usable data exists.
function renderStandingsStrip(standing, accentColor) {
  if (!standing) return "";
  const { divisionName, divisionRank, wins, losses, gamesBack, wildCardRank, wildCardGamesBack } =
    standing;

  if (wins === null || losses === null || !divisionRank) return "";

  const divOrdinal = ordinal(divisionRank);
  const gbLabel = gamesBack && gamesBack !== "-" ? `${gamesBack} GB` : "1st in division";
  const divLine =
    divisionRank === 1
      ? `${divisionName} &middot; <strong>1st</strong> &middot; ${wins}&ndash;${losses}`
      : `${divisionName} &middot; <strong>${divOrdinal}</strong> &middot; ${wins}&ndash;${losses} &middot; ${gbLabel}`;

  let wcLine = "";
  if (divisionRank !== 1 && wildCardRank) {
    const wcOrdinal = ordinal(wildCardRank);
    const wcSuffix =
      wildCardGamesBack && wildCardGamesBack !== "-"
        ? ` (${wildCardGamesBack})`
        : "";
    wcLine = `<div style="margin-top:4px;font-size:13px;color:#52525b;">Wild Card: <strong>${wcOrdinal}</strong>${wcSuffix}</div>`;
  }

  return `
  <!-- Standings strip (spoiler-safe: as of the day before first pitch) -->
  <tr><td style="padding:16px 32px 0 32px;">
    <div style="border-left:3px solid ${accentColor};padding:8px 12px;background-color:rgba(0,0,0,0.02);border-radius:0 4px 4px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.5px;color:#71717a;text-transform:uppercase;margin-bottom:4px;">Standings entering today</div>
      <div style="font-size:14px;color:#3f3f46;">${divLine}</div>
      ${wcLine}
    </div>
  </td></tr>`;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function buildEmailHtml(team, highlightUrl, userId, gameDate, standing = null) {
  const siteUrl = getSiteUrl();
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${userId}`;
  const tipUrl = process.env.TIP_URL;
  const teamName = team?.name || "Your team";
  const teamColor = team?.color || "#2563eb";
  const teamAbbr = team?.abbr || "";
  const displayDate = formatDisplayDate(gameDate);
  const standingsHtml = renderStandingsStrip(standing, teamColor);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${teamName} Highlights</title>
</head>
<body style="margin:0;padding:0;background-color:#efece4;font-family:'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efece4;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${BRAND_PAPER};border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">

  <!-- Team color accent bar -->
  <tr><td style="height:6px;background-color:${teamColor};"></td></tr>

  <!-- Wordmark + date -->
  <tr><td style="padding:24px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>${brandWordmarkHtml({ size: 14 })}</td>
        <td align="right" style="color:#71717a;font-size:12px;font-family:'JetBrains Mono','SF Mono',Menlo,monospace;letter-spacing:0.06em;text-transform:uppercase;">${displayDate}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Header (team chip) -->
  <tr><td style="padding:18px 32px 0 32px;">
    <span style="display:inline-block;background-color:${teamColor};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;border-radius:4px;">${teamAbbr}</span>
  </td></tr>

  <!-- Title -->
  <tr><td style="padding:14px 32px 0 32px;">
    <h1 style="margin:0;font-family:'General Sans','Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:24px;font-weight:600;color:#1a1d1c;line-height:1.3;letter-spacing:-0.02em;">${teamName} highlights are ready</h1>
    <p style="margin:8px 0 0 0;font-size:15px;color:#52525b;line-height:1.5;">Your spoiler-free game recap is waiting for you.</p>
  </td></tr>

  ${standingsHtml}

  <!-- CTA Button -->
  <tr><td style="padding:24px 32px 0 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr><td align="center">
        <a href="${highlightUrl}" style="display:inline-block;background-color:${teamColor};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">Watch Highlights &#9654;</a>
      </td></tr>
      <tr><td align="center" style="padding-top:8px;font-size:12px;color:#a1a1aa;">
        Video: <a href="https://www.mlb.com" style="color:#a1a1aa;">MLB.com</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer divider -->
  <tr><td style="padding:32px 32px 0 32px;">
    <hr style="margin:0;border:none;border-top:1px solid #e4e4e7;">
  </td></tr>

  ${tipUrl ? `
  <!-- Tip prompt -->
  <tr><td align="center" style="padding:18px 32px 0 32px;">
    <p style="margin:0;font-size:13px;color:#52525b;line-height:1.5;">
      Enjoying Ninth Inning Email? <a href="${tipUrl}" style="color:${teamColor};text-decoration:underline;font-weight:600;">Tip the developer</a> to keep it running.
    </p>
  </td></tr>
  ` : ""}

  <!-- Forward prompt -->
  <tr><td align="center" style="padding:12px 32px 0 32px;">
    <p style="margin:0;font-size:13px;color:#52525b;line-height:1.5;">
      Know a fan who&#39;d like this? Forward them this email or send them <a href="${siteUrl}" style="color:${teamColor};text-decoration:underline;font-weight:600;">ninthinning.email</a>.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#a1a1aa;">
          ${brandWordmarkHtml({ size: 13, ink: "#52525b" })}<br>
          <span style="font-size:12px;color:#a1a1aa;">Spoiler-free MLB recaps</span>
        </td>
        <td align="right" style="font-size:12px;vertical-align:top;">
          <a href="${unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline;">Unsubscribe</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Disclaimer -->
  <tr><td style="padding:12px 32px 28px 32px;">
    <p style="margin:0;font-size:11px;color:#a1a1aa;line-height:1.5;">Ninth Inning Email is not affiliated with, endorsed by, or sponsored by MLB or any MLB club. Questions or takedown requests: <a href="mailto:abuse@ninthinning.email" style="color:#a1a1aa;">abuse@ninthinning.email</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}
