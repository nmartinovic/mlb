// MLB Stats API utilities — shared between cron worker and any server context.

export async function fetchSchedule(teamId, dateStr) {
  const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&date=${dateStr}&sportId=1`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MLB API ${res.status} for team ${teamId} on ${dateStr}`);
  }
  return res.json();
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
  const items = content?.highlights?.highlights?.items;
  if (!items?.length) return null;

  const recap = items.find((item) =>
    item.keywordsAll?.some(
      (k) => k.value === "game-recap" || k.value === "MLBCOM_GAME_RECAP"
    )
  );
  if (!recap) return null;

  const playbacks = recap?.playbacks;
  if (!playbacks?.length) return null;

  const preferred = playbacks.find((p) => /mp4Avc|2500K/i.test(p.name));
  return preferred?.url || playbacks[playbacks.length - 1]?.url || null;
}

export function getDatesToCheck() {
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

export function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
