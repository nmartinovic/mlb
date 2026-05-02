// MLB Stats API utilities — shared between cron worker and any server context.

export async function fetchSchedule(teamId, dateStr) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&date=${dateStr}&sportId=1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for team ${teamId} on ${dateStr}`);
  }
  return res.json();
}

export async function fetchDailySchedule(dateStr) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for daily schedule on ${dateStr}`);
  }
  return res.json();
}

export function extractScheduledGames(scheduleData) {
  const games = scheduleData?.dates?.[0]?.games || [];
  return games.filter((g) => typeof g.gamePk === "number" && typeof g.gameDate === "string");
}

// First pitch + ~3.5h is the average MLB game length. The main cron treats this
// as the centerpoint of an asymmetric polling window (start 30m before, keep
// polling 2.5h after — see EARLY_BOUND_MS / LATE_BOUND_MS in app/api/cron/route.js).
export const EXPECTED_GAME_DURATION_HOURS = 3.5;

export function computeExpectedFinish(gameDateIso, durationHours = EXPECTED_GAME_DURATION_HOURS) {
  const start = new Date(gameDateIso);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + durationHours * 60 * 60 * 1000);
}

export function extractFinalGames(scheduleData) {
  const games = scheduleData?.dates?.[0]?.games || [];
  return games.filter((g) => g.status?.abstractGameState === "Final");
}

export async function fetchGameContent(gamePk) {
  const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/content`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MLB content API ${res.status} for game ${gamePk}`);
  }
  return res.json();
}

export function extractHighlightUrl(content) {
  // Try the legacy highlights path first
  const items = content?.highlights?.highlights?.items;
  if (items?.length) {
    const recap = items.find((item) =>
      item.keywordsAll?.some(
        (k) => k.value === "game-recap" || k.value === "MLBCOM_GAME_RECAP"
      )
    );
    if (recap) {
      const url = pickPlaybackUrl(recap.playbacks);
      if (url) return url;
    }
  }

  // Fallback: check media.epg for recap/condensed game content
  const epg = content?.media?.epg;
  if (Array.isArray(epg)) {
    const recapEpg = epg.find(
      (e) => e.title === "Recap" || e.title === "Extended Highlights"
    );
    const recapItem = recapEpg?.items?.[0];
    if (recapItem) {
      const url = pickPlaybackUrl(recapItem.playbacks);
      if (url) return url;
    }

    // Also try condensed game
    const condensed = epg.find((e) => e.title === "Condensed Game");
    const condensedItem = condensed?.items?.[0];
    if (condensedItem) {
      const url = pickPlaybackUrl(condensedItem.playbacks);
      if (url) return url;
    }
  }

  return null;
}


function pickPlaybackUrl(playbacks) {
  if (!Array.isArray(playbacks) || playbacks.length === 0) return null;
  const preferred = playbacks.find((p) => /mp4Avc|2500K/i.test(p.name || p.url || ""));
  return preferred?.url || playbacks[playbacks.length - 1]?.url || null;
}

export function getEtTodayDate(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

export function getDatesToCheck() {
  const now = new Date();
  const today = getEtTodayDate(now);
  const yesterday = getEtTodayDate(new Date(now.getTime() - 86400000));
  const twoDaysAgo = getEtTodayDate(new Date(now.getTime() - 2 * 86400000));
  return [today, yesterday, twoDaysAgo];
}

export function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
