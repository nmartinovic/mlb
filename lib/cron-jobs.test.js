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
  buildMultiGameEmailHtml: () => "<html>batched recap</html>",
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
// `pausedUserIds`: user ids the mlb_user_preferences query reports as currently
//   paused (the .gt() time filter is the DB's job — the mock just returns the
//   already-filtered set).
function makeSupabaseMock({ cachedHighlightUrl = undefined, pausedUserIds = [] } = {}) {
  const sentInsert = vi.fn(async () => ({ error: null }));
  const cacheUpsert = vi.fn(async () => ({ error: null }));
  const cronRunInsert = vi.fn();
  const cronRunUpdate = vi.fn();
  const client = {
    from: vi.fn((table) => {
      if (table === "mlb_cron_runs") {
        return {
          insert: (row) => {
            cronRunInsert(row);
            return {
              select: () => ({
                single: async () => ({ data: { id: "run-1" }, error: null }),
              }),
            };
          },
          update: (patch) => {
            cronRunUpdate(patch);
            return {
              eq: async () => ({ error: null }),
              in: () => ({
                lt: () => ({
                  select: async () => ({ data: [], error: null }),
                }),
              }),
            };
          },
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
          upsert: cacheUpsert,
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
          insert: sentInsert,
        };
      }
      if (table === "mlb_user_preferences") {
        return {
          select: () => ({
            in: () => ({
              gt: async () => ({
                data: pausedUserIds.map((id) => ({ user_id: id })),
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  return { client, sentInsert, cacheUpsert, cronRunInsert, cronRunUpdate };
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

describe("runMainCron — dry-run mode (#180)", () => {
  it("skips the Brevo send and the mlb_sent_notifications insert", async () => {
    const { client, sentInsert } = makeSupabaseMock({ cachedHighlightUrl: HIGHLIGHT_URL });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sentInsert).not.toHaveBeenCalled();
  });

  it("still upserts mlb_game_cache so cache logic is exercised", async () => {
    // Cache row exists but highlight_url is null → the game is re-fetched and
    // the cache upsert must still run in dry-run mode.
    const { client, cacheUpsert } = makeSupabaseMock({ cachedHighlightUrl: null });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());
    fetchGameContent.mockResolvedValue(makeContentWithHighlight());

    await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(fetchGameContent).toHaveBeenCalledWith(GAME_PK);
    expect(cacheUpsert).toHaveBeenCalledTimes(1);
    expect(cacheUpsert.mock.calls[0][0]).toMatchObject({
      game_pk: GAME_PK,
      highlight_url: HIGHLIGHT_URL,
    });
  });

  it("finalizes the run with status dry_run instead of success", async () => {
    const { client, cronRunUpdate } = makeSupabaseMock({ cachedHighlightUrl: HIGHLIGHT_URL });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    await runMainCron({ supabase: client, force: true, dryRun: true });

    const finalize = cronRunUpdate.mock.calls
      .map((c) => c[0])
      .find((patch) => patch.status === "dry_run");
    expect(finalize).toBeDefined();
    expect(finalize).toMatchObject({ status: "dry_run", emails_sent: 1, games_processed: 1 });
    expect(
      cronRunUpdate.mock.calls.some((c) => c[0].status === "success")
    ).toBe(false);
  });

  it("returns a dryRunReport with one entry per would-be email", async () => {
    const { client } = makeSupabaseMock({ cachedHighlightUrl: HIGHLIGHT_URL });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(result.body.message).toMatch(/DRY RUN/);
    expect(result.body.dryRunReport).toHaveLength(1);
    expect(result.body.dryRunReport[0]).toMatchObject({
      gamePk: GAME_PK,
      teamId: TEAM_ID,
      userId: USER_ID,
      email: USER_EMAIL,
      highlightUrl: HIGHLIGHT_URL,
    });
    expect(result.body.dryRunReport[0].subject).toEqual(expect.any(String));
  });

  it("includes an empty dryRunReport when there are no subscribers", async () => {
    const { client } = makeSupabaseMock({ cachedHighlightUrl: HIGHLIGHT_URL });
    // Override mlb_user_teams to return no rows.
    const baseFrom = client.from;
    client.from = vi.fn((table) => {
      if (table === "mlb_user_teams") {
        return { select: () => ({ limit: async () => ({ data: [], error: null }) }) };
      }
      return baseFrom(table);
    });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(result.body.message).toBe("No subscribed teams");
    expect(result.body.dryRunReport).toEqual([]);
  });

  it("does not write a dryRunReport on a normal (non-dry) run", async () => {
    const { client } = makeSupabaseMock({ cachedHighlightUrl: HIGHLIGHT_URL });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    const result = await runMainCron({ supabase: client, force: true });

    expect(result.body.dryRunReport).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("runMainCron — paused-notification skip (#22)", () => {
  it("sends no email and writes no dedup row for a paused subscriber", async () => {
    const { client, sentInsert } = makeSupabaseMock({
      cachedHighlightUrl: HIGHLIGHT_URL,
      pausedUserIds: [USER_ID],
    });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    const result = await runMainCron({ supabase: client, force: true });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sentInsert).not.toHaveBeenCalled();
    expect(result.body.message).toMatch(/sent 0 emails/);
    expect(result.body.skipped).toContainEqual(
      expect.objectContaining({ userId: USER_ID, reason: "notifications_paused" })
    );
  });

  it("still emails a subscriber who is not paused", async () => {
    const { client } = makeSupabaseMock({
      cachedHighlightUrl: HIGHLIGHT_URL,
      pausedUserIds: [],
    });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    await runMainCron({ supabase: client, force: true });

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("omits a paused subscriber from the dry-run report", async () => {
    const { client } = makeSupabaseMock({
      cachedHighlightUrl: HIGHLIGHT_URL,
      pausedUserIds: [USER_ID],
    });
    fetchDailySchedule.mockResolvedValue(makeDailySchedule());

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(result.body.dryRunReport).toEqual([]);
  });
});
