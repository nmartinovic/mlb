import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSchedule,
  fetchDailySchedule,
  extractFinalGames,
  extractScheduledGames,
  computeExpectedFinish,
  fetchGameContent,
  extractHighlightUrl,
  getDatesToCheck,
  getEtTodayDate,
  formatDisplayDate,
  EXPECTED_GAME_DURATION_HOURS,
} from "./mlb";

describe("fetchSchedule", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on a 200 response", async () => {
    const payload = { dates: [{ games: [] }] };
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    });

    const result = await fetchSchedule(147, "2026-04-27");

    expect(fetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/schedule?teamId=147&date=2026-04-27&sportId=1"
    );
    expect(result).toEqual(payload);
  });

  it("throws when the response is not ok", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    await expect(fetchSchedule(147, "2026-04-27")).rejects.toThrow(
      "MLB API 500 for team 147 on 2026-04-27"
    );
  });

  it("throws on a 404 with the team and date in the message", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    await expect(fetchSchedule(999, "2026-01-01")).rejects.toThrow(
      "MLB API 404 for team 999 on 2026-01-01"
    );
  });
});

describe("extractFinalGames", () => {
  it("returns only games whose abstractGameState is Final", () => {
    const data = {
      dates: [
        {
          games: [
            { gamePk: 1, status: { abstractGameState: "Final" } },
            { gamePk: 2, status: { abstractGameState: "Live" } },
            { gamePk: 3, status: { abstractGameState: "Preview" } },
            { gamePk: 4, status: { abstractGameState: "Final" } },
          ],
        },
      ],
    };

    const finals = extractFinalGames(data);

    expect(finals.map((g) => g.gamePk)).toEqual([1, 4]);
  });

  it("returns an empty array when there are no dates", () => {
    expect(extractFinalGames({})).toEqual([]);
    expect(extractFinalGames({ dates: [] })).toEqual([]);
    expect(extractFinalGames(null)).toEqual([]);
  });
});

describe("fetchGameContent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hits the content endpoint and returns the body", async () => {
    const body = { highlights: { highlights: { items: [] } } };
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });

    const result = await fetchGameContent(746789);

    expect(fetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/game/746789/content"
    );
    expect(result).toEqual(body);
  });

  it("throws when the response is not ok", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

    await expect(fetchGameContent(123)).rejects.toThrow(
      "MLB content API 503 for game 123"
    );
  });
});

describe("extractHighlightUrl", () => {
  it("picks the recap from the legacy highlights path", () => {
    const content = {
      highlights: {
        highlights: {
          items: [
            {
              keywordsAll: [{ value: "game-recap" }],
              playbacks: [
                { name: "FLASH_2500K_1280X720", url: "https://example.com/recap-2500k.mp4" },
                { name: "mp4Avc", url: "https://example.com/recap-mp4avc.mp4" },
              ],
            },
          ],
        },
      },
    };

    expect(extractHighlightUrl(content)).toBe("https://example.com/recap-2500k.mp4");
  });

  it("falls back to media.epg Recap when no legacy highlight matches", () => {
    const content = {
      highlights: { highlights: { items: [] } },
      media: {
        epg: [
          {
            title: "Recap",
            items: [
              {
                playbacks: [
                  { name: "mp4Avc", url: "https://example.com/epg-recap.mp4" },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(extractHighlightUrl(content)).toBe("https://example.com/epg-recap.mp4");
  });

  it("falls back to Condensed Game when no Recap exists", () => {
    const content = {
      media: {
        epg: [
          {
            title: "Condensed Game",
            items: [
              {
                playbacks: [
                  { name: "fallback", url: "https://example.com/condensed.mp4" },
                ],
              },
            ],
          },
        ],
      },
    };

    expect(extractHighlightUrl(content)).toBe("https://example.com/condensed.mp4");
  });

  it("returns null when no highlight is available anywhere", () => {
    expect(extractHighlightUrl({})).toBeNull();
    expect(extractHighlightUrl(null)).toBeNull();
    expect(
      extractHighlightUrl({ highlights: { highlights: { items: [] } }, media: { epg: [] } })
    ).toBeNull();
  });
});

describe("getDatesToCheck", () => {
  it("returns three dates in YYYY-MM-DD format spanning today, yesterday, two days ago", () => {
    const dates = getDatesToCheck();

    expect(dates).toHaveLength(3);
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const sorted = [...dates].sort();
    expect(sorted[0]).toBe(dates[2]);
    expect(sorted[2]).toBe(dates[0]);
  });
});

describe("fetchDailySchedule", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the league-wide slate without a teamId filter", async () => {
    const payload = { dates: [{ games: [{ gamePk: 1 }, { gamePk: 2 }] }] };
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload });

    const result = await fetchDailySchedule("2026-05-02");

    expect(fetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-05-02"
    );
    expect(result).toEqual(payload);
  });

  it("throws on a non-ok response with the date in the message", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });

    await expect(fetchDailySchedule("2026-05-02")).rejects.toThrow(
      "MLB API 502 for daily schedule on 2026-05-02"
    );
  });
});

describe("extractScheduledGames", () => {
  it("returns games that have a gamePk and gameDate", () => {
    const data = {
      dates: [
        {
          games: [
            { gamePk: 100, gameDate: "2026-05-02T17:05:00Z" },
            { gamePk: 101 },
            { gameDate: "2026-05-02T18:05:00Z" },
            { gamePk: 102, gameDate: "2026-05-02T20:10:00Z" },
          ],
        },
      ],
    };

    const games = extractScheduledGames(data);
    expect(games.map((g) => g.gamePk)).toEqual([100, 102]);
  });

  it("returns an empty array when the slate is empty or missing", () => {
    expect(extractScheduledGames({})).toEqual([]);
    expect(extractScheduledGames({ dates: [] })).toEqual([]);
    expect(extractScheduledGames(null)).toEqual([]);
  });
});

describe("computeExpectedFinish", () => {
  it("adds the default 3.5h duration to first pitch", () => {
    const finish = computeExpectedFinish("2026-05-02T17:05:00Z");
    expect(finish.toISOString()).toBe("2026-05-02T20:35:00.000Z");
    expect(EXPECTED_GAME_DURATION_HOURS).toBe(3.5);
  });

  it("respects a custom duration", () => {
    const finish = computeExpectedFinish("2026-05-02T17:00:00Z", 4);
    expect(finish.toISOString()).toBe("2026-05-02T21:00:00.000Z");
  });

  it("returns null on an unparseable date", () => {
    expect(computeExpectedFinish("not-a-date")).toBeNull();
  });
});

describe("getEtTodayDate", () => {
  it("formats a UTC instant as the corresponding ET calendar date", () => {
    // 2026-05-02 03:00 UTC = 2026-05-01 23:00 EDT
    expect(getEtTodayDate(new Date("2026-05-02T03:00:00Z"))).toBe("2026-05-01");
    // 2026-05-02 17:00 UTC = 2026-05-02 13:00 EDT
    expect(getEtTodayDate(new Date("2026-05-02T17:00:00Z"))).toBe("2026-05-02");
  });
});

describe("formatDisplayDate", () => {
  it("formats an ISO-style date as a long-form US date", () => {
    expect(formatDisplayDate("2026-04-27")).toBe("April 27, 2026");
  });

  it("does not shift days due to timezone parsing", () => {
    // A naive `new Date("2026-01-01")` parses as UTC midnight, which can render as
    // Dec 31 in negative UTC offsets. The helper splits/parses manually to avoid this.
    expect(formatDisplayDate("2026-01-01")).toBe("January 1, 2026");
  });
});
