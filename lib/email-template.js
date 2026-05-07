import { formatDisplayDate } from "@/lib/mlb";

const BRAND_GREEN = "#2c5e4e";

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
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

  <!-- Brand accent bar -->
  <tr><td style="height:6px;background-color:${accent};"></td></tr>

  <!-- Title -->
  <tr><td style="padding:28px 32px 0 32px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">You&#39;re in.</h1>
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

  <!-- Footer -->
  <tr><td style="padding:16px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#a1a1aa;">
          <strong style="color:#52525b;">Ninth Inning Email</strong><br>
          Spoiler-free MLB recaps
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

export function buildEmailHtml(team, highlightUrl, userId, gameDate) {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com";
  const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${userId}`;
  const tipUrl = process.env.TIP_URL;
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

  <!-- Footer -->
  <tr><td style="padding:16px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:13px;color:#a1a1aa;">
          <strong style="color:#52525b;">Ninth Inning Email</strong><br>
          Spoiler-free MLB recaps
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
