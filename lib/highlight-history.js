// Highlight-history helpers (#90).
//
// The /dashboard/highlights page shows a user the recaps we have actually
// emailed them — sourced from mlb_sent_notifications, not "every game the
// teams you follow played." buildHighlightHistory joins those send records
// against the cached game metadata in mlb_game_cache so the page can render
// one row per recap that links to the branded highlights page.

// game_pk = 0 is the welcome-email sentinel (#26), not a real game.
export const WELCOME_SENTINEL_GAME_PK = 0;

// Joins sent-notification rows with cached game metadata.
//
// sentRows:      [{ game_pk, sent_at }, ...]      from mlb_sent_notifications
// gameCacheRows: [{ game_pk, team_id, game_date, highlight_url }, ...]
//
// Returns one item per real recap, newest-sent first. A send is dropped when
// it is the welcome sentinel, or when no cached game row exists for it — the
// branded highlights page notFound()s on an unknown game_pk, so such a row
// could not link anywhere useful.
export function buildHighlightHistory(sentRows, gameCacheRows) {
  const cacheByPk = new Map(
    (gameCacheRows || []).map((g) => [g.game_pk, g]),
  );

  return (sentRows || [])
    .filter((row) => row.game_pk !== WELCOME_SENTINEL_GAME_PK)
    .map((row) => {
      const game = cacheByPk.get(row.game_pk);
      if (!game) return null;
      return {
        gamePk: row.game_pk,
        teamId: game.team_id,
        gameDate: game.game_date,
        highlightUrl: game.highlight_url ?? null,
        sentAt: row.sent_at,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
}
