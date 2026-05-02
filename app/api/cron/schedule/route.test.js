import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const fetchDailySchedule = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: (...args) => createAdminClient(...args),
}));

vi.mock("@/lib/mlb", async () => {
  const actual = await vi.importActual("@/lib/mlb");
  return {
    ...actual,
    fetchDailySchedule: (...args) => fetchDailySchedule(...args),
  };
});

function makeSupabaseMock({ upsertResult = { error: null }, deleteResult = { error: null } } = {}) {
  const insertedRuns = [];
  const upsertCalls = [];
  const deleteCalls = [];
  const updates = [];

  const client = {
    from: vi.fn((table) => {
      if (table === "mlb_cron_runs") {
        return {
          insert: vi.fn((row) => {
            insertedRuns.push(row);
            return {
              select: () => ({
                single: async () => ({ data: { id: "run-1" }, error: null }),
              }),
            };
          }),
          update: vi.fn((patch) => {
            updates.push(patch);
            return { eq: vi.fn(async () => ({ error: null })) };
          }),
        };
      }
      if (table === "mlb_cron_schedule") {
        return {
          upsert: vi.fn(async (rows, opts) => {
            upsertCalls.push({ rows, opts });
            return upsertResult;
          }),
          delete: vi.fn(() => ({
            lt: vi.fn(async (col, value) => {
              deleteCalls.push({ col, value });
              return deleteResult;
            }),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return { client, insertedRuns, upsertCalls, deleteCalls, updates };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.CRON_SECRET = "secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
});

function makeRequest({ auth = "Bearer secret" } = {}) {
  return new Request("https://ninthinning.email/api/cron/schedule", {
    headers: auth ? { Authorization: auth } : {},
  });
}

describe("GET /api/cron/schedule", () => {
  it("rejects missing or wrong bearer token with 401", async () => {
    const { GET } = await import("./route");

    const res1 = await GET(makeRequest({ auth: null }));
    const res2 = await GET(makeRequest({ auth: "Bearer wrong" }));

    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("upserts one wake row per game with first_pitch + 3.5h", async () => {
    const { client, upsertCalls, deleteCalls, updates } = makeSupabaseMock();
    createAdminClient.mockReturnValue(client);
    fetchDailySchedule.mockResolvedValue({
      dates: [
        {
          games: [
            { gamePk: 100, gameDate: "2026-05-02T17:05:00Z" },
            { gamePk: 101, gameDate: "2026-05-02T23:10:00Z" },
          ],
        },
      ],
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].opts).toEqual({ onConflict: "game_pk" });
    expect(upsertCalls[0].rows).toEqual([
      {
        game_pk: 100,
        expected_finish_at: "2026-05-02T20:35:00.000Z",
        game_date: expect.any(String),
      },
      {
        game_pk: 101,
        expected_finish_at: "2026-05-03T02:40:00.000Z",
        game_date: expect.any(String),
      },
    ]);
    expect(deleteCalls).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "schedule_built", games_processed: 2 });
  });

  it("skips the upsert and still prunes when the slate is empty", async () => {
    const { client, upsertCalls, deleteCalls, updates } = makeSupabaseMock();
    createAdminClient.mockReturnValue(client);
    fetchDailySchedule.mockResolvedValue({ dates: [] });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(upsertCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "schedule_built", games_processed: 0 });
  });

  it("records schedule_failure when MLB API throws", async () => {
    const { client, updates } = makeSupabaseMock();
    createAdminClient.mockReturnValue(client);
    fetchDailySchedule.mockRejectedValue(new Error("MLB API 503 for daily schedule on 2026-05-02"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
    expect(updates[0]).toMatchObject({ status: "schedule_failure" });
    expect(updates[0].errors_count).toBe(1);
  });
});
