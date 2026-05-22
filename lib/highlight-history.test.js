import { describe, expect, it } from "vitest";
import {
  WELCOME_SENTINEL_GAME_PK,
  buildHighlightHistory,
} from "./highlight-history";

const game = (overrides) => ({
  game_pk: 100,
  team_id: 147,
  game_date: "2026-05-20",
  highlight_url: "https://www.mlb.com/video/clip-100",
  ...overrides,
});

describe("buildHighlightHistory", () => {
  it("returns an empty list when there are no sent notifications", () => {
    expect(buildHighlightHistory([], [game()])).toEqual([]);
    expect(buildHighlightHistory(null, null)).toEqual([]);
    expect(buildHighlightHistory(undefined, undefined)).toEqual([]);
  });

  it("joins a single send against its cached game metadata", () => {
    const out = buildHighlightHistory(
      [{ game_pk: 100, sent_at: "2026-05-21T13:00:00Z" }],
      [game()],
    );
    expect(out).toEqual([
      {
        gamePk: 100,
        teamId: 147,
        gameDate: "2026-05-20",
        highlightUrl: "https://www.mlb.com/video/clip-100",
        sentAt: "2026-05-21T13:00:00Z",
      },
    ]);
  });

  it("orders many sends newest-sent first regardless of input order", () => {
    const out = buildHighlightHistory(
      [
        { game_pk: 100, sent_at: "2026-05-19T13:00:00Z" },
        { game_pk: 102, sent_at: "2026-05-21T13:00:00Z" },
        { game_pk: 101, sent_at: "2026-05-20T13:00:00Z" },
      ],
      [
        game({ game_pk: 100 }),
        game({ game_pk: 101 }),
        game({ game_pk: 102 }),
      ],
    );
    expect(out.map((h) => h.gamePk)).toEqual([102, 101, 100]);
  });

  it("drops the welcome-email sentinel send", () => {
    const out = buildHighlightHistory(
      [
        { game_pk: WELCOME_SENTINEL_GAME_PK, sent_at: "2026-05-18T13:00:00Z" },
        { game_pk: 100, sent_at: "2026-05-21T13:00:00Z" },
      ],
      [game({ game_pk: 100 })],
    );
    expect(out.map((h) => h.gamePk)).toEqual([100]);
  });

  it("drops a send with no cached game row (branded page would notFound)", () => {
    const out = buildHighlightHistory(
      [
        { game_pk: 100, sent_at: "2026-05-21T13:00:00Z" },
        { game_pk: 999, sent_at: "2026-05-20T13:00:00Z" },
      ],
      [game({ game_pk: 100 })],
    );
    expect(out.map((h) => h.gamePk)).toEqual([100]);
  });

  it("keeps a send whose cached game has no highlight_url yet", () => {
    const out = buildHighlightHistory(
      [{ game_pk: 100, sent_at: "2026-05-21T13:00:00Z" }],
      [game({ highlight_url: null })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].highlightUrl).toBeNull();
  });
});
