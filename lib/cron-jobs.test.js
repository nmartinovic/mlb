import { beforeEach, describe, expect, it, vi } from "vitest";
import { runMainCron } from "@/lib/cron-jobs";

const fetchDailySchedule = vi.fn();
const fetchGameContent = vi.fn();
const fetchStandings = vi.fn();
const getDatesToCheck = vi.fn();

vi.mock("@/lib/mlb", async () => {
  const actual = await vi.importActual("@/lib/mlb");
  return {
    ...actual,
    fetchDailySchedule: (...args) => fetchDailySchedule(...args),
    fetchGameContent: (...args) => fetchGameContent(...args),
    fetchStandings: (...args) => fetchStandings(...args),
    getDatesToCheck: () => getDatesToCheck(),
  };
});

const sendEmail = vi.fn();
vi.mock("@/lib/brevo", () => ({
  sendEmail: (...args) => sendEmail(...args),
}));

vi.mock("@/lib/email-template", () => ({
  buildEmailHtml: () => "<html>recap</html>",
}));

const GAME_PK = 700123;
const TEAM_ID = 147;
const DATE_STR = "2026-05-18";
const USER_ID = "user-abc";
const USER_EMAIL = "fan@example.com";
const HIGHLIGHT_URL = "https://mlb.com/video/highlight-123";

function makeDailySchedule(gamePk = GAME_PK, homeTeamId = TEAM_ID) {
  return {
    dates: [
      {
        date: DATE_STR,
        games: [
          {
            gamePk,
            gameDate: `${DATE_STR}T23:00:00Z`,
            status: { abstractGameState: "Final" },
            teams: {
              home: { team: { id: homeTeamId, name: "New York Yankees" }, isWinner: true },
              away: { team: { id: 111, name: "Boston Red Sox" }, isWinner: false },
            },
            seriesGameNumber: 1,
            gamesInSeries: 3,
          },
        ],
      },
    ],
  };
}

function makeContentWithHighlight(url = HIGHLIGHT_URL) {
  return {
    highlights: {
      highlights: {
        items: [
          {
            keywordsAll: [{ value: "game-recap" }],
            playbacks: [{ name: "mp4Avc", url }],
          },
        ],
      },
    },
  };
}

// `cachedHighlightUrl`:
//   undefined  → no row in cache (fresh game, never checked)
//   null       → row exists with highlight_url = null (checked, no highlight yet)
//   string     → row exists with a real URL (highlight already found)
function makeSupabaseMock({ cachedHighlightUrl = undefined } = {}) {
  const client = {
    from: vi.fn((table) => {
      if (table === "mlb_cron_runs") {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: "run-1" }, error: null }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
            in: () => ({
              lt: () => ({
                select: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "mlb_user_teams") {
        return {
          select: () => ({
            limit: async () => ({
              data: [{ user_id: USER_ID, team_id: TEAM_ID }],
              error: null,
            }),
          }),
        };
      }
      if (table === "mlb_game_cache") {
        return {
          select: () => ({
            in: async () => ({
              data:
                cachedHighlightUrl !== undefined
                  ? [{ game_pk: GAME_PK, highlight_url: cachedHighlightUrl }]
                  : [],
              error: null,
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }
      if (table === "mlb_users") {
        return {
          select: () => ({
            in: async () => ({
              data: [{ id: USER_ID, email: USER_EMAIL }],
              error: null,
            }),
          }),
        };
      }
      if (table === "mlb_sent_notifications") {
        return {
          select: () => ({
            in: () => ({
              in: async () => ({ data: [], error: null }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  return { client };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDatesToCheck.mockReturnValue([DATE_STR]);
  fetchStandings.mockResolvedValue({ records: [] });
  sendEmail.mockResolvedValue({ ok: true });
});

describe("runMainCron — null highlight_url cache regression (#178)", () => {
  it("re-fetches content and sends email when cache row has highlight_url = null", async () => {
    // The bug: .has() returned true for null-url rows, setting url = null and
    // skipping the game. Fix: use .get() so a falsy value falls through to the
    // content fetch.
    const { client } = makeSupabaseMock({ cachedHighlightUrl: null });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());
    fetchGameContent.mockResolvedValue(makeContentWithHighlight());

    const result = await runMainCron({ supabase: client, force: true });

    expect(fetchGameContent).toHaveBeenCalledWith(GAME_PK);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(USER_EMAIL, expect.any(String), expect.any(String), undefined);
    expect(result.body.message).toMatch(/sent 1 email/);
  });

  it("uses the cached URL and sends email without re-fetching when highlight_url is already set", async () => {
    const { client } = makeSupabaseMock({ cachedHighlightUrl: HIGHLIGHT_URL });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    const result = await runMainCron({ supabase: client, force: true });

    expect(fetchGameContent).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(result.body.message).toMatch(/sent 1 email/);
  });

  it("fetches content and skips email when cache is null and highlight is still unavailable", async () => {
    const { client } = makeSupabaseMock({ cachedHighlightUrl: null });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());
    fetchGameContent.mockResolvedValue({});

    const result = await runMainCron({ supabase: client, force: true });

    expect(fetchGameContent).toHaveBeenCalledWith(GAME_PK);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(result.body.message).toBe("No new highlights available");
  });
});
