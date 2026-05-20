import { beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end dry-run coverage for runMainCron (#180).
//
// Unlike lib/cron-jobs.test.js, this suite mocks ONLY the network boundary —
// the MLB Stats API fetches and the Brevo send. Everything in between runs for
// real: extractFinalGames, extractHighlightUrl, extractSeriesContext,
// extractTeamStanding and buildEmailHtml. That exercises the full fan-out loop
// against a realistic multi-game / multi-subscriber fixture, catching the class
// of bug from #172/#178 that function-level mocks would miss.

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

// Brevo is the one side effect we stub. In dry-run mode runMainCron must never
// call it — the test asserts that. buildEmailHtml is intentionally NOT mocked.
const sendEmail = vi.fn();
vi.mock("@/lib/brevo", () => ({
  sendEmail: (...args) => sendEmail(...args),
}));

import { runMainCron } from "@/lib/cron-jobs";

const DATE_STR = "2026-05-18";

// Teams: Yankees 147, Red Sox 111, Dodgers 119, Giants 137, Cubs 112, Reds 113,
// Astros 117, Angels 108.
const GAME_A = 700001; // Yankees (home) vs Red Sox — both fanbases subscribed
const GAME_B = 700002; // Dodgers (home) vs Giants — cache row has null URL
const GAME_C = 700003; // Cubs (home) vs Reds — no highlight available
const GAME_D = 700004; // Astros vs Angels — nobody subscribed, must be ignored

function finalGame(gamePk, homeId, awayId, seriesGameNumber, gamesInSeries) {
  return {
    gamePk,
    gameDate: `${DATE_STR}T23:05:00Z`,
    status: { abstractGameState: "Final" },
    teams: {
      home: { team: { id: homeId }, isWinner: true },
      away: { team: { id: awayId }, isWinner: false },
    },
    seriesGameNumber,
    gamesInSeries,
  };
}

function dailySchedule() {
  return {
    dates: [
      {
        date: DATE_STR,
        games: [
          finalGame(GAME_A, 147, 111, 2, 3),
          finalGame(GAME_B, 119, 137, 1, 3),
          finalGame(GAME_C, 112, 113, 3, 3),
          finalGame(GAME_D, 117, 108, 1, 3),
          // An in-progress game — extractFinalGames must drop it.
          {
            gamePk: 700005,
            gameDate: `${DATE_STR}T23:40:00Z`,
            status: { abstractGameState: "Live" },
            teams: {
              home: { team: { id: 147 } },
              away: { team: { id: 110 } },
            },
          },
        ],
      },
    ],
  };
}

function contentWithHighlight(url) {
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

const STANDINGS = {
  records: [
    {
      division: { id: 201, name: "American League East" },
      teamRecords: [
        {
          team: { id: 147 },
          divisionRank: "1",
          wins: 28,
          losses: 16,
          gamesBack: "-",
          wildCardRank: "-",
          wildCardGamesBack: "-",
        },
        {
          team: { id: 111 },
          divisionRank: "4",
          wins: 21,
          losses: 23,
          gamesBack: "7.0",
          wildCardRank: "3",
          wildCardGamesBack: "2.5",
        },
      ],
    },
    {
      division: { id: 204, name: "National League West" },
      teamRecords: [
        {
          team: { id: 119 },
          divisionRank: "2",
          wins: 26,
          losses: 18,
          gamesBack: "1.5",
          wildCardRank: "1",
          wildCardGamesBack: "+1.0",
        },
      ],
    },
  ],
};

// Realistic multi-subscriber fixture. user-5 has no email; user-4 already
// received Game A; user-3 follows two teams.
const SUBSCRIBED_TEAMS = [
  { user_id: "user-1", team_id: 147 },
  { user_id: "user-2", team_id: 111 },
  { user_id: "user-3", team_id: 147 },
  { user_id: "user-3", team_id: 119 },
  { user_id: "user-4", team_id: 147 },
  { user_id: "user-5", team_id: 111 },
  { user_id: "user-6", team_id: 112 },
];

const USERS = [
  { id: "user-1", email: "yankees-fan@example.com" },
  { id: "user-2", email: "redsox-fan@example.com" },
  { id: "user-3", email: "dual-fan@example.com" },
  { id: "user-4", email: "repeat-fan@example.com" },
  { id: "user-5", email: null },
  { id: "user-6", email: "cubs-fan@example.com" },
];

// Builds a Supabase stub rich enough for the whole runMainCron pipeline and
// records every write so the test can assert side effects were/weren't taken.
function makeSupabaseMock() {
  const writes = {
    cronRunInserts: [],
    cronRunUpdates: [],
    cacheUpserts: [],
    sentInserts: [],
  };

  const client = {
    from(table) {
      switch (table) {
        case "mlb_cron_runs":
          return {
            insert(row) {
              writes.cronRunInserts.push(row);
              return {
                select: () => ({
                  single: async () => ({ data: { id: "run-1" }, error: null }),
                }),
              };
            },
            update(patch) {
              writes.cronRunUpdates.push(patch);
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
        case "mlb_user_teams":
          return {
            select: () => ({
              limit: async () => ({ data: SUBSCRIBED_TEAMS, error: null }),
            }),
          };
        case "mlb_game_cache":
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { game_pk: GAME_A, highlight_url: "https://mlb.com/video/yankees-recap" },
                  { game_pk: GAME_B, highlight_url: null },
                ],
                error: null,
              }),
            }),
            upsert: async (row) => {
              writes.cacheUpserts.push(row);
              return { error: null };
            },
          };
        case "mlb_users":
          return {
            select: () => ({
              in: async () => ({ data: USERS, error: null }),
            }),
          };
        case "mlb_sent_notifications":
          return {
            select: () => ({
              in: () => ({
                in: async () => ({
                  data: [{ user_id: "user-4", game_pk: GAME_A }],
                  error: null,
                }),
              }),
            }),
            insert: async (row) => {
              writes.sentInserts.push(row);
              return { error: null };
            },
          };
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    },
  };

  return { client, writes };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDatesToCheck.mockReturnValue([DATE_STR]);
  fetchDailySchedule.mockResolvedValue(dailySchedule());
  fetchStandings.mockResolvedValue(STANDINGS);
  fetchGameContent.mockImplementation(async (gamePk) => {
    if (gamePk === GAME_B) return contentWithHighlight("https://mlb.com/video/dodgers-recap");
    if (gamePk === GAME_C) return {}; // no highlight available
    throw new Error(`fetchGameContent called unexpectedly for ${gamePk}`);
  });
  sendEmail.mockResolvedValue({ ok: true });
});

describe("runMainCron — end-to-end dry run, multi-game multi-subscriber (#180)", () => {
  it("produces the correct dryRunReport across the full fan-out", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(result.status).toBe(200);
    expect(result.body.message).toMatch(/^DRY RUN/);

    const report = result.body.dryRunReport;
    // Game A → Yankees: user-1, user-3 (user-4 deduped). Game A → Red Sox:
    // user-2 (user-5 has no email). Game B → Dodgers: user-3. = 4 emails.
    expect(report).toHaveLength(4);

    const recipients = report.map((r) => r.email).sort();
    expect(recipients).toEqual([
      "dual-fan@example.com", // Game A, Yankees
      "dual-fan@example.com", // Game B, Dodgers
      "redsox-fan@example.com", // Game A, Red Sox
      "yankees-fan@example.com", // Game A, Yankees
    ]);
  });

  it("dedupes a subscriber who already received the game", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });

    const repeatEntries = result.body.dryRunReport.filter(
      (r) => r.userId === "user-4"
    );
    expect(repeatEntries).toHaveLength(0);
  });

  it("skips a subscriber with no email and never reports the no-subscriber game", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });
    const report = result.body.dryRunReport;

    // user-5 (no email) must not appear.
    expect(report.some((r) => r.userId === "user-5")).toBe(false);
    // Game D (Astros/Angels) has no subscribers — never processed.
    expect(report.some((r) => r.gamePk === GAME_D)).toBe(false);
    // Game C (Cubs) has no highlight — never emailed.
    expect(report.some((r) => r.gamePk === GAME_C)).toBe(false);
  });

  it("renders real subjects for each rooting team", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });
    const byTeam = new Map(result.body.dryRunReport.map((r) => [r.teamId, r.subject]));

    expect(byTeam.get(147)).toMatch(/^New York Yankees Highlights/);
    expect(byTeam.get(111)).toMatch(/^Boston Red Sox Highlights/);
    expect(byTeam.get(119)).toMatch(/^Los Angeles Dodgers Highlights/);
  });

  it("carries the correct highlight URL — cached for Game A, freshly fetched for Game B", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });
    const report = result.body.dryRunReport;

    for (const entry of report.filter((r) => r.gamePk === GAME_A)) {
      expect(entry.highlightUrl).toBe("https://mlb.com/video/yankees-recap");
    }
    for (const entry of report.filter((r) => r.gamePk === GAME_B)) {
      expect(entry.highlightUrl).toBe("https://mlb.com/video/dodgers-recap");
    }
    // Game A's highlight came from cache — its content endpoint is untouched.
    expect(fetchGameContent).not.toHaveBeenCalledWith(GAME_A);
    expect(fetchGameContent).toHaveBeenCalledWith(GAME_B);
    expect(fetchGameContent).toHaveBeenCalledWith(GAME_C);
  });

  it("attaches spoiler-safe series context from each team's perspective", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });
    const report = result.body.dryRunReport;

    const yankees = report.find((r) => r.gamePk === GAME_A && r.teamId === 147);
    expect(yankees.seriesContext).toMatchObject({
      opponentName: "Red Sox",
      isHome: true,
      seriesGameNumber: 2,
      gamesInSeries: 3,
    });

    const redsox = report.find((r) => r.gamePk === GAME_A && r.teamId === 111);
    expect(redsox.seriesContext).toMatchObject({
      opponentName: "Yankees",
      isHome: false,
      seriesGameNumber: 2,
      gamesInSeries: 3,
    });

    const dodgers = report.find((r) => r.gamePk === GAME_B);
    expect(dodgers.seriesContext).toMatchObject({
      opponentName: "Giants",
      isHome: true,
      seriesGameNumber: 1,
    });
  });

  it("attaches the spoiler-safe standings snapshot", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });
    const report = result.body.dryRunReport;

    // Standings are queried for the day BEFORE the game date.
    expect(fetchStandings).toHaveBeenCalledWith("2026-05-17");

    const yankees = report.find((r) => r.gamePk === GAME_A && r.teamId === 147);
    expect(yankees.standing).toMatchObject({
      divisionName: "AL East",
      divisionRank: 1,
      wins: 28,
      losses: 16,
    });
  });

  it("performs no irreversible side effects — no send, no dedup insert", async () => {
    const { client, writes } = makeSupabaseMock();

    await runMainCron({ supabase: client, force: true, dryRun: true });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(writes.sentInserts).toHaveLength(0);
  });

  it("still upserts mlb_game_cache for games it had to fetch", async () => {
    const { client, writes } = makeSupabaseMock();

    await runMainCron({ supabase: client, force: true, dryRun: true });

    // Game B (null cache) and Game C (uncached) get re-checked and upserted;
    // Game A was already cached so it is not re-written.
    const upsertedPks = writes.cacheUpserts.map((r) => r.game_pk).sort();
    expect(upsertedPks).toEqual([GAME_B, GAME_C]);
  });

  it("finalizes the run with the distinct dry_run status", async () => {
    const { client, writes } = makeSupabaseMock();

    await runMainCron({ supabase: client, force: true, dryRun: true });

    const finalize = writes.cronRunUpdates.find((u) => u.status === "dry_run");
    expect(finalize).toBeDefined();
    expect(finalize).toMatchObject({
      status: "dry_run",
      games_processed: 3,
      emails_sent: 4,
    });
    expect(writes.cronRunUpdates.some((u) => u.status === "success")).toBe(false);
  });

  it("sends real emails and writes dedup rows when dryRun is off", async () => {
    const { client, writes } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true });

    // Same fan-out, but now the side effects fire.
    expect(result.body.message).toMatch(/sent 4 emails/);
    expect(result.body.dryRunReport).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(4);
    expect(writes.sentInserts).toHaveLength(4);
    expect(writes.cronRunUpdates.some((u) => u.status === "success")).toBe(true);
  });
});
