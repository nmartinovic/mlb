// MLB Stats API utilities — shared between cron worker and any server context.

// Per-call timeout so a slow upstream can't hang the cron's wall-clock budget
// (issue #154). Cloudflare's `fetch()` waits indefinitely without an
// AbortSignal; a single hung MLB request used to kill the whole tick before
// `finalizeRun()` could update mlb_cron_runs, leaving rows zombied as "running".
const MLB_FETCH_TIMEOUT_MS = 8000;

export async function fetchSchedule(teamId, dateStr) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&date=${dateStr}&sportId=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(MLB_FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for team ${teamId} on ${dateStr}`);
  }
  return res.json();
}

export async function fetchDailySchedule(dateStr) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(MLB_FETCH_TIMEOUT_MS) });
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
  const res = await fetch(url, { signal: AbortSignal.timeout(MLB_FETCH_TIMEOUT_MS) });
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

// Standings: the MLB Stats API returns historical standings when given a `date`
// param in MM/DD/YYYY form. For spoiler-safety we always query the day BEFORE
// today's first pitch (ET), so the rendered "as fans walked in" snapshot can't
// reflect the game we're about to recap. See issue #148.
export async function fetchStandings(dateStr) {
  const apiDate = toMlbDateParam(dateStr);
  const season = dateStr.slice(0, 4);
  const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&date=${apiDate}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(MLB_FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`MLB standings API ${res.status} for date ${dateStr}`);
  }
  return res.json();
}

function toMlbDateParam(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${m}/${d}/${y}`;
}

// AL = 103, NL = 104. Division IDs are stable across seasons.
const DIVISION_NAMES = {
  200: "AL West",
  201: "AL East",
  202: "AL Central",
  203: "AL West",
  204: "NL West",
  205: "NL East",
  // Stats API uses both 202/200 and 203 historically — keep a defensive map.
};
const DIVISION_NAMES_FALLBACK = {
  AL_E: "AL East",
  AL_C: "AL Central",
  AL_W: "AL West",
  NL_E: "NL East",
  NL_C: "NL Central",
  NL_W: "NL West",
};

export function extractTeamStanding(standings, teamId) {
  const records = standings?.records;
  if (!Array.isArray(records) || records.length === 0) return null;

  for (const rec of records) {
    const teams = rec.teamRecords || [];
    const match = teams.find((t) => t?.team?.id === teamId);
    if (!match) continue;

    const divisionName =
      rec.division?.name ||
      DIVISION_NAMES[rec.division?.id] ||
      DIVISION_NAMES_FALLBACK[rec.division?.abbreviation] ||
      "Division";

    return {
      divisionName: shortenDivisionName(divisionName),
      divisionRank: toIntOrNull(match.divisionRank),
      wins: match.wins ?? null,
      losses: match.losses ?? null,
      gamesBack: match.gamesBack ?? null,
      wildCardRank: toIntOrNull(match.wildCardRank),
      wildCardGamesBack: match.wildCardGamesBack ?? null,
    };
  }
  return null;
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// "American League East" → "AL East". MLB API sometimes returns the long form.
function shortenDivisionName(name) {
  return name
    .replace(/^American League\s+/i, "AL ")
    .replace(/^National League\s+/i, "NL ");
}

// Spoiler-safe series context for the recap email (issue #69). Returns the
// rooting team's perspective: opponent id, home/away, and the game's position
// in the series. Numbers are normalized to ints; anything missing or malformed
// returns null so the template can omit the line cleanly.
export function extractSeriesContext(game, teamId) {
  if (!game || !teamId) return null;
  const homeId = game?.teams?.home?.team?.id;
  const awayId = game?.teams?.away?.team?.id;
  if (homeId !== teamId && awayId !== teamId) return null;
  const isHome = homeId === teamId;
  const opponentId = isHome ? awayId : homeId;
  if (!opponentId) return null;
  return {
    opponentId,
    isHome,
    seriesGameNumber: toIntOrNull(game.seriesGameNumber),
    gamesInSeries: toIntOrNull(game.gamesInSeries),
  };
}

// Fetch the next scheduled (non-postponed) game for a team after `afterDateStr`
// ("YYYY-MM-DD" in ET). Looks up to 14 days ahead. Returns
// `{ gameDate, opponentId, isHome }` or `null` on any error / no game found.
// Always fails open — a null return simply omits the "Next up" line from the
// email rather than blocking the send.
export async function fetchNextGame(teamId, afterDateStr) {
  try {
    const [y, m, d] = afterDateStr.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d + 1));
    const end = new Date(Date.UTC(y, m - 1, d + 15));
    const fmt = (dt) => dt.toISOString().slice(0, 10);
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${teamId}&startDate=${fmt(start)}&endDate=${fmt(end)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(MLB_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    for (const dateEntry of data.dates || []) {
      for (const game of dateEntry.games || []) {
        const state = game.status?.detailedState;
        if (state === "Postponed" || state === "Cancelled" || state === "Suspended") continue;
        const isHome = game.teams?.home?.team?.id === teamId;
        const opponentId = isHome
          ? game.teams?.away?.team?.id
          : game.teams?.home?.team?.id;
        if (!opponentId) continue;
        return { gameDate: game.gameDate, opponentId, isHome };
      }
    }
    return null;
  } catch {
    return null;
  }
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
