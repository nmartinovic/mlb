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
// `pausedUserIds` is the set the mlb_user_preferences query reports as paused
// (the .gt() time filter is the DB's job — the mock returns the filtered set).
function makeSupabaseMock({ pausedUserIds = [] } = {}) {
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
            insert: async (rows) => {
              // runMainCron batches one insert call per recipient with an
              // array of game rows (#27); flatten so assertions stay row-level.
              for (const row of Array.isArray(rows) ? rows : [rows]) {
                writes.sentInserts.push(row);
              }
              return { error: null };
            },
          };
        case "mlb_user_preferences":
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

  it("uses a single-team subject for one game and a batched subject for many", async () => {
    const { client } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });
    const subjectByUser = new Map(
      result.body.dryRunReport.map((r) => [r.userId, r.subject])
    );

    // user-1 follows only the Yankees → classic single-game subject.
    expect(subjectByUser.get("user-1")).toMatch(/^New York Yankees Highlights — /);
    // user-2 follows only the Red Sox → classic single-game subject.
    expect(subjectByUser.get("user-2")).toMatch(/^Boston Red Sox Highlights — /);
    // user-3 follows the Yankees and the Dodgers, both with a game this run →
    // one batched subject naming both teams (#27).
    expect(subjectByUser.get("user-3")).toMatch(/^Your .* highlights — /);
    expect(subjectByUser.get("user-3")).toContain("Yankees");
    expect(subjectByUser.get("user-3")).toContain("Dodgers");
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
    // 3 games processed (Game A ×2 teams + Game B), but only 3 emails — the
    // dual-team subscriber's two games batch into one email (#27).
    expect(finalize).toMatchObject({
      status: "dry_run",
      games_processed: 3,
      emails_sent: 3,
    });
    expect(writes.cronRunUpdates.some((u) => u.status === "success")).toBe(false);
  });

  it("sends real emails and writes dedup rows when dryRun is off", async () => {
    const { client, writes } = makeSupabaseMock();

    const result = await runMainCron({ supabase: client, force: true });

    // Same fan-out, but now the side effects fire. 3 emails (the dual-team
    // subscriber's two games batch into one), 4 dedup rows (one per game).
    expect(result.body.message).toMatch(/sent 3 emails/);
    expect(result.body.dryRunReport).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(writes.sentInserts).toHaveLength(4);
    expect(writes.cronRunUpdates.some((u) => u.status === "success")).toBe(true);
  });

  it("skips paused subscribers across every game they would receive (#22)", async () => {
    // user-3 follows both the Yankees and the Dodgers — pausing them must drop
    // both their Game A and Game B emails. user-1 (Yankees only) is paused too.
    // The baseline fan-out is 4 emails; with user-1 and user-3 paused only
    // user-2 (Red Sox, Game A) is left.
    const { client, writes } = makeSupabaseMock({ pausedUserIds: ["user-1", "user-3"] });

    const result = await runMainCron({ supabase: client, force: true });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      "redsox-fan@example.com",
      expect.any(String),
      expect.any(String),
      undefined
    );
    expect(writes.sentInserts).toEqual([
      { user_id: "user-2", game_pk: GAME_A },
    ]);
    expect(result.body.message).toMatch(/sent 1 emails/);
  });

  it("omits paused subscribers from the dry-run report (#22)", async () => {
    const { client } = makeSupabaseMock({ pausedUserIds: ["user-1", "user-3"] });

    const result = await runMainCron({ supabase: client, force: true, dryRun: true });

    const recipients = result.body.dryRunReport.map((r) => r.email);
    expect(recipients).toEqual(["redsox-fan@example.com"]);
  });
});

describe("runMainCron — batched multi-game email (#27)", () => {
  it("sends one combined email to a subscriber with multiple finished games", async () => {
    const { client, writes } = makeSupabaseMock();

    await runMainCron({ supabase: client, force: true });

    // dual-fan follows the Yankees (Game A) and the Dodgers (Game B); both
    // finished this run, so they receive exactly ONE email, not two.
    const dualFanCalls = sendEmail.mock.calls.filter(
      (c) => c[0] === "dual-fan@example.com"
    );
    expect(dualFanCalls).toHaveLength(1);

    // That one email's body carries both games' highlights and team names.
    const [, subject, html] = dualFanCalls[0];
    expect(html).toContain("mlb.com/video/yankees-recap");
    expect(html).toContain("mlb.com/video/dodgers-recap");
    expect(html).toContain("New York Yankees");
    expect(html).toContain("Los Angeles Dodgers");
    expect(subject).toMatch(/^Your .* highlights — /);

    // Each game still gets its own dedup row so a re-run won't resend either.
    expect(writes.sentInserts).toContainEqual({ user_id: "user-3", game_pk: GAME_A });
    expect(writes.sentInserts).toContainEqual({ user_id: "user-3", game_pk: GAME_B });
  });

  it("still sends a single-game email to a subscriber with only one game", async () => {
    const { client } = makeSupabaseMock();

    await runMainCron({ supabase: client, force: true });

    const yankeesOnly = sendEmail.mock.calls.filter(
      (c) => c[0] === "yankees-fan@example.com"
    );
    expect(yankeesOnly).toHaveLength(1);
    // One game → unchanged single-team subject, no "Your … highlights" prefix.
    expect(yankeesOnly[0][1]).toMatch(/^New York Yankees Highlights — /);
  });
});
