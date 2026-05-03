// Post-deploy bootstrap + smoke checks. Issue #108.
//
// Cloudflare cron triggers fire on schedule, not on registration. A deploy
// landing after 13:00 UTC creates a window of up to 24h where the daily
// scheduler trigger exists but has produced no rows in mlb_cron_schedule, and
// the every-15-min main cron early-returns the whole day. This script closes
// that window by:
//   1. POSTing once to /api/cron/schedule so the table is populated immediately.
//   2. Verifying both expected cron triggers are registered with Cloudflare.
//   3. Asserting today's schedule has rows when MLB has games today.
//
// Required env: CRON_SECRET.
// Optional env: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (enables the
// Cloudflare-side trigger check; without them the script warns and continues).

const SITE_URL = process.env.SITE_URL || "https://ninthinning.email";
const CRON_SECRET = process.env.CRON_SECRET;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const WORKER_NAME = "mlb";
const EXPECTED_CRONS = ["*/15 * * * *", "0 13 * * *"];

function fail(msg) {
  console.error(`\npost-deploy: FAIL — ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`post-deploy: WARN — ${msg}`);
}

function info(msg) {
  console.log(`post-deploy: ${msg}`);
}

if (!CRON_SECRET) {
  fail(
    "CRON_SECRET is not set in your local env. Export it (export CRON_SECRET=...) " +
      "or source it from a gitignored .env.local before running deploy. The bootstrap " +
      "call to /api/cron/schedule needs it.",
  );
}

// ---------------------------------------------------------------------------
// 1) Bootstrap call to /api/cron/schedule
// ---------------------------------------------------------------------------

info(`bootstrapping mlb_cron_schedule via ${SITE_URL}/api/cron/schedule …`);

let bootstrapResp;
try {
  bootstrapResp = await fetch(`${SITE_URL}/api/cron/schedule`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
} catch (err) {
  fail(`network error calling /api/cron/schedule: ${err.message}`);
}

const bootstrapBody = await bootstrapResp.text();
if (bootstrapResp.status !== 200) {
  fail(`/api/cron/schedule returned HTTP ${bootstrapResp.status}: ${bootstrapBody}`);
}

let bootstrapJson;
try {
  bootstrapJson = JSON.parse(bootstrapBody);
} catch {
  fail(`/api/cron/schedule did not return JSON: ${bootstrapBody}`);
}

const match = /Scheduled (\d+) wakes for (\d{4}-\d{2}-\d{2})/.exec(bootstrapJson.message || "");
if (!match) {
  fail(`unexpected response shape from /api/cron/schedule: ${bootstrapBody}`);
}
const wakeCount = Number(match[1]);
const dateStr = match[2];
info(`bootstrap response: ${bootstrapJson.message}`);

// ---------------------------------------------------------------------------
// 2) Verify Cloudflare cron triggers are registered
// ---------------------------------------------------------------------------

if (CF_API_TOKEN && CF_ACCOUNT_ID) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}/schedules`;
  let cfResp;
  try {
    cfResp = await fetch(url, { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } });
  } catch (err) {
    fail(`network error calling Cloudflare schedules API: ${err.message}`);
  }
  if (!cfResp.ok) {
    fail(`Cloudflare schedules API returned HTTP ${cfResp.status}: ${await cfResp.text()}`);
  }
  const cfJson = await cfResp.json();
  const registered = (cfJson?.result?.schedules || []).map((s) => s.cron);
  const missing = EXPECTED_CRONS.filter((c) => !registered.includes(c));
  if (missing.length > 0) {
    fail(
      `Cloudflare is missing expected cron triggers: ${missing.join(", ")} ` +
        `(registered: ${registered.join(", ") || "none"})`,
    );
  }
  info(`Cloudflare confirms triggers ${registered.join(", ")}`);
} else {
  warn(
    "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set; skipping Cloudflare-side " +
      "trigger verification. Set both to enable.",
  );
}

// ---------------------------------------------------------------------------
// 3) Assert today's row presence (skip on offseason)
// ---------------------------------------------------------------------------

if (wakeCount > 0) {
  info(`mlb_cron_schedule has ${wakeCount} row(s) for ${dateStr}`);
} else {
  // Offseason: no MLB games today is normal. Confirm with a direct MLB API
  // probe so a transient failure of the upsert (e.g. Supabase blip) doesn't
  // hide behind a "must be offseason" assumption.
  let mlbHasGames = null;
  try {
    const mlbResp = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}`);
    if (mlbResp.ok) {
      const data = await mlbResp.json();
      mlbHasGames = (data?.dates?.[0]?.games || []).length > 0;
    }
  } catch {
    // ignore — handled below
  }

  if (mlbHasGames === true) {
    fail(
      `0 wakes scheduled for ${dateStr} but MLB API reports games on that date. ` +
        `mlb_cron_schedule is empty; the main cron will early-return all day.`,
    );
  } else if (mlbHasGames === false) {
    info(`no MLB games on ${dateStr}; offseason — skipping row-presence assertion.`);
  } else {
    warn(
      `0 wakes scheduled for ${dateStr} and could not reach the MLB API to confirm ` +
        `whether today is offseason. Verify manually before walking away.`,
    );
  }
}

console.log("\npost-deploy: all checks passed");
