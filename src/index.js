import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEAM_ID = 136;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const SENT_GAMES_PATH = join(__dirname, "..", "sent-games.json");
const MARINERS_VIDEO_URL = "https://www.mlb.com/mariners/video";

function getDatesToCheck() {
  if (process.env.DATE_OVERRIDE) return [process.env.DATE_OVERRIDE];

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const now = new Date();
  const today = formatter.format(now);
  const yesterday = formatter.format(new Date(now.getTime() - 86400000));
  return [today, yesterday];
}

function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function scheduleUrl(dateStr) {
  return `https://statsapi.mlb.com/api/v1/schedule?teamId=${TEAM_ID}&date=${dateStr}&sportId=1`;
}

async function fetchSchedule(dateStr) {
  const url = scheduleUrl(dateStr);
  console.log(`Fetching schedule for ${dateStr}...`);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `MLB API returned ${res.status}: ${body.slice(0, 200)}`
    );
  }
  return res.json();
}

function extractFinalGames(scheduleData) {
  const games = scheduleData?.dates?.[0]?.games || [];
  return games.filter(
    (g) => g.status?.abstractGameState === "Final"
  );
}

async function fetchGameContent(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/content`;
  console.log(`Fetching game content for ${gamePk}...`);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `MLB content API returned ${res.status}: ${body.slice(0, 200)}`
    );
  }
  return res.json();
}

function extractHighlightUrl(content, gamePk) {
  // The condensed game recap lives in content.highlights.highlights.items
  // alongside individual play clips. We need to find the "Condensed Game" item.
  const items = content?.highlights?.highlights?.items;

  if (!items?.length) {
    console.log(`No highlight items found for game ${gamePk}.`);
    return null;
  }

  console.log(
    `Available items for game ${gamePk}: ` +
      items.map((i) => `"${i.title || i.headline}"`).join(", ")
  );

  // Look for the condensed game recap (e.g. "Condensed Game: CLE@SEA - 3/27/26")
  const condensed = items.find((item) =>
    /condensed game/i.test(item.title || item.headline)
  );

  if (!condensed) {
    console.log(`No "Condensed Game" item found for game ${gamePk}.`);
    return null;
  }

  console.log(`Selected: "${condensed.title || condensed.headline}"`);

  const playbacks = condensed?.playbacks;
  if (!playbacks?.length) {
    console.log(`Condensed game item found but no playbacks for game ${gamePk}.`);
    return null;
  }

  const preferred = playbacks.find((p) => /mp4Avc|2500K/i.test(p.name));
  const url = preferred?.url || playbacks[playbacks.length - 1]?.url;

  if (url) {
    console.log(`Found highlight URL for game ${gamePk}: ${url}`);
  }
  return url || null;
}

async function loadSentGames() {
  try {
    const data = await readFile(SENT_GAMES_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    console.log("Could not read sent-games.json, starting fresh.");
    return [];
  }
}

async function saveSentGames(gameIds) {
  await writeFile(SENT_GAMES_PATH, JSON.stringify(gameIds, null, 2) + "\n");
  console.log(`Saved sent-games.json with ${gameIds.length} entries.`);
}

function buildEmailHtml(dateStr, entries) {
  const hasUrls = entries.some((e) => e.url);
  const multiple = entries.length > 1;

  if (!hasUrls) {
    return [
      "<p>Today's Mariners highlights aren't available yet.</p>",
      `<p><a href="${MARINERS_VIDEO_URL}">Check MLB.com for highlights</a></p>`,
    ].join("\n");
  }

  const lines = ["<p>Today's Mariners highlights are ready.</p>"];
  for (let i = 0; i < entries.length; i++) {
    const { url } = entries[i];
    if (url) {
      const label = multiple ? `Watch Game ${i + 1} highlights` : "Watch highlights";
      lines.push(`<p><a href="${url}">${label}</a></p>`);
    } else {
      const label = multiple ? `Game ${i + 1}` : "Highlights";
      lines.push(
        `<p>${label} not yet available &mdash; <a href="${MARINERS_VIDEO_URL}">check MLB.com</a></p>`
      );
    }
  }
  return lines.join("\n");
}

async function sendEmail(subject, html) {
  if (process.env.DRY_RUN) {
    console.log("--- DRY RUN (no email sent) ---");
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${html}`);
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.EMAIL_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: process.env.FROM_EMAIL },
      to: [{ email: process.env.RECIPIENT_EMAIL }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API error (${res.status}): ${body.slice(0, 300)}`);
  }
  console.log(`Email sent to ${process.env.RECIPIENT_EMAIL}.`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const dates = getDatesToCheck();
  const sentGames = await loadSentGames();

  // Collect final games from today and yesterday (catches late-finishing games)
  const allNewGames = [];
  for (const dateStr of dates) {
    const scheduleData = await fetchSchedule(dateStr);
    const finalGames = extractFinalGames(scheduleData);

    for (const game of finalGames) {
      if (!sentGames.includes(game.gamePk)) {
        allNewGames.push({ game, dateStr });
      }
    }
  }

  if (allNewGames.length === 0) {
    console.log("No new final Mariners games to process.");
    return;
  }

  console.log(`Found ${allNewGames.length} new final game(s) to process.`);

  const results = [];

  for (const { game, dateStr } of allNewGames) {
    let url = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const content = await fetchGameContent(game.gamePk);
      url = extractHighlightUrl(content, game.gamePk);
      if (url) break;

      if (attempt < MAX_RETRIES) {
        console.log(
          `Highlights not available for game ${game.gamePk}, ` +
            `retry ${attempt}/${MAX_RETRIES} in 15 min...`
        );
        await sleep(RETRY_DELAY_MS);
      }
    }

    results.push({ gamePk: game.gamePk, url, dateStr });
  }

  // Use the game's scheduled date for the email subject
  const primaryDate = results[0].dateStr;
  const subject = `Mariners Highlights \u2014 ${formatDisplayDate(primaryDate)}`;
  const html = buildEmailHtml(primaryDate, results);
  await sendEmail(subject, html);

  const updatedSentGames = [...sentGames, ...results.map((r) => r.gamePk)];
  await saveSentGames(updatedSentGames);

  console.log(
    `Done. Processed game(s): ${results.map((r) => r.gamePk).join(", ")}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
