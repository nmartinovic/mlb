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

export function getDatesToCheck() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const now = new Date();
  const today = formatter.format(now);
  const yesterday = formatter.format(new Date(now.getTime() - 86400000));
  const twoDaysAgo = formatter.format(new Date(now.getTime() - 2 * 86400000));
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
