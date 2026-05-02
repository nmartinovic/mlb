import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClient = vi.fn();
const fetchSchedule = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: (...args) => createAdminClient(...args),
}));

vi.mock("@/lib/mlb", async () => {
  const actual = await vi.importActual("@/lib/mlb");
  return {
    ...actual,
    fetchSchedule: (...args) => fetchSchedule(...args),
  };
});

vi.mock("@/lib/brevo", () => ({
  sendEmail: (...args) => sendEmail(...args),
}));

// Build a supabase mock whose mlb_cron_schedule query returns a configurable
// result. Other tables get inert no-op handlers.
function makeSupabaseMock({ scheduleRows = [], scheduleError = null } = {}) {
  const inserted = [];
  const updates = [];

  const handlers = {
    mlb_cron_schedule: () => ({
      select: () => ({
        gte: () => ({
          lte: () => ({
            limit: async () => ({ data: scheduleRows, error: scheduleError }),
          }),
        }),
      }),
    }),
    mlb_cron_runs: () => ({
      insert: (row) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: "run-1" }, error: null }),
          }),
        };
      },
      update: (patch) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
    mlb_user_teams: () => ({
      select: () => ({
        limit: async () => ({ data: [], error: null }),
      }),
    }),
  };

  const client = {
    from: vi.fn((table) => {
      const make = handlers[table];
      if (!make) throw new Error(`unexpected table ${table}`);
      return make();
    }),
  };
  return { client, inserted, updates };
}

function makeRequest({ auth = "Bearer secret" } = {}) {
  return new Request("https://ninthinning.email/api/cron", {
    headers: auth ? { Authorization: auth } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.CRON_SECRET = "secret";
  process.env.EMAILS_PAUSED = "";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
});

describe("GET /api/cron — schedule-aware early return (#76)", () => {
  it("rejects missing bearer token with 401 before touching anything", async () => {
    const { GET } = await import("./route");

    const res = await GET(makeRequest({ auth: null }));

    expect(res.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("skips early — no MLB API — but writes a heartbeat row when no wake is in the window (#104)", async () => {
    const { client, inserted, updates } = makeSupabaseMock({ scheduleRows: [] });
    createAdminClient.mockReturnValue(client);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      message: "No scheduled wake within window — skipped",
    });
    expect(fetchSchedule).not.toHaveBeenCalled();
    // One heartbeat row: insert (status: running) + update (status: skipped_no_wake).
    expect(inserted).toEqual([{ status: "running" }]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      status: "skipped_no_wake",
      games_processed: 0,
      emails_sent: 0,
      errors_count: 0,
      errors: null,
    });
    expect(updates[0].finished_at).toEqual(expect.any(String));
  });

  it("queries mlb_cron_schedule with an asymmetric window (now-2.5h, now+30m)", async () => {
    const gteSpy = vi.fn(() => ({ lte: lteSpy }));
    const lteSpy = vi.fn(() => ({
      limit: async () => ({ data: [], error: null }),
    }));
    // Re-build chain with spies after both are declared.
    const chain = {
      select: () => ({
        gte: (col, value) => {
          gteSpy(col, value);
          return {
            lte: (col2, value2) => {
              lteSpy(col2, value2);
              return { limit: async () => ({ data: [], error: null }) };
            },
          };
        },
      }),
    };

    const client = {
      from: vi.fn((table) => {
        if (table === "mlb_cron_schedule") return chain;
        if (table === "mlb_cron_runs") {
          return {
            insert: () => ({ select: () => ({ single: async () => ({ data: { id: "x" }, error: null }) }) }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        throw new Error(`unexpected ${table}`);
      }),
    };
    createAdminClient.mockReturnValue(client);

    const fixedNow = new Date("2026-05-02T20:00:00Z").getTime();
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    const { GET } = await import("./route");
    await GET(makeRequest());

    expect(gteSpy).toHaveBeenCalledWith(
      "expected_finish_at",
      new Date(fixedNow - 2.5 * 60 * 60 * 1000).toISOString()
    );
    expect(lteSpy).toHaveBeenCalledWith(
      "expected_finish_at",
      new Date(fixedNow + 30 * 60 * 1000).toISOString()
    );
  });

  it("falls through to the full run when the schedule read errors", async () => {
    const { client } = makeSupabaseMock({
      scheduleError: { message: "boom" },
      scheduleRows: null,
    });
    createAdminClient.mockReturnValue(client);

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    // No subscribers in our mock, so the run completes with "no_subscribers" —
    // the point is that we got past the early-return on a schedule read error.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "No subscribed teams" });
  });

  it("respects EMAILS_PAUSED and short-circuits before the schedule read", async () => {
    process.env.EMAILS_PAUSED = "true";
    const fromMock = vi.fn(() => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: "p" }, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }));
    createAdminClient.mockReturnValue({ from: fromMock });

    const { GET } = await import("./route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Emails paused via kill switch" });
    // Only mlb_cron_runs was hit (insert + update), not mlb_cron_schedule.
    for (const call of fromMock.mock.calls) {
      expect(call[0]).toBe("mlb_cron_runs");
    }
  });
});
