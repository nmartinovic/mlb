import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mock state — vi.mock factory bodies are hoisted above imports, so the
// shared state has to live inside vi.hoisted() to be in-scope when the factory
// runs.
const hoisted = vi.hoisted(() => ({
  authUser: null,
  adminSupabase: null,
  sendEmailImpl: vi.fn(),
  fetchStandingsImpl: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: hoisted.authUser } }),
    },
  }),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => hoisted.adminSupabase,
}));

vi.mock("@/lib/brevo", () => ({
  sendEmail: (...args) => hoisted.sendEmailImpl(...args),
  SENDER_NAME: "Ninth Inning Email",
}));

vi.mock("@/lib/mlb", async () => {
  const actual = await vi.importActual("@/lib/mlb");
  return {
    ...actual,
    fetchStandings: (...args) => hoisted.fetchStandingsImpl(...args),
  };
});

// Imported after vi.mock so the mocked deps resolve.
const { resendLatestRecapAction } = await import("./actions");

// Builds a chainable Supabase query stub. Each call to `.from(table)` returns a
// fresh query object whose terminal calls (`.maybeSingle()`, `.single()`,
// awaiting directly) resolve to the script entry registered for that table.
function makeSupabaseStub(script) {
  const calls = [];

  function makeQuery(table) {
    const entry = script[table];
    if (!entry) {
      throw new Error(`No script entry for table "${table}"`);
    }
    const result = entry.shift ? entry.shift() : entry;

    const query = {
      _table: table,
      select() {
        return query;
      },
      eq() {
        return query;
      },
      gt() {
        return query;
      },
      not() {
        return query;
      },
      order() {
        return query;
      },
      limit() {
        return query;
      },
      maybeSingle() {
        return Promise.resolve(result);
      },
      single() {
        return Promise.resolve(result);
      },
      then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };

    return query;
  }

  return {
    from(table) {
      calls.push(table);
      return makeQuery(table);
    },
    _calls: calls,
  };
}

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_ID = "admin-user-id";

beforeEach(() => {
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
  delete process.env.EMAILS_PAUSED;
  hoisted.authUser = { id: ADMIN_ID, email: ADMIN_EMAIL };
  hoisted.sendEmailImpl = vi.fn(async () => undefined);
  hoisted.fetchStandingsImpl = vi.fn(async () => ({ records: [] }));
  hoisted.adminSupabase = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resendLatestRecapAction", () => {
  it("rejects a non-admin caller without sending", async () => {
    hoisted.authUser = { id: "other-id", email: "imposter@example.com" };
    hoisted.adminSupabase = makeSupabaseStub({});

    const result = await resendLatestRecapAction(null, null);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Forbidden");
    expect(hoisted.sendEmailImpl).not.toHaveBeenCalled();
  });

  it("returns a clear message when the admin has no prior recaps and the cache is empty", async () => {
    hoisted.adminSupabase = makeSupabaseStub({
      mlb_sent_notifications: { data: null, error: null },
      mlb_game_cache: { data: null, error: null },
    });

    const result = await resendLatestRecapAction(null, null);

    expect(result.ok).toBe(false);
    expect(result.message).toBe("No recaps found to resend");
    expect(hoisted.sendEmailImpl).not.toHaveBeenCalled();
  });

  it("re-renders and sends the admin's most recent recap with a [TEST] prefix", async () => {
    // Yankees (team 147) — used to assert the team name lands in the HTML.
    const gamePk = 778899;
    hoisted.adminSupabase = makeSupabaseStub({
      mlb_sent_notifications: {
        data: { game_pk: gamePk, sent_at: "2026-05-10T03:00:00Z" },
        error: null,
      },
      mlb_game_cache: {
        data: {
          game_pk: gamePk,
          team_id: 147,
          game_date: "2026-05-09",
          highlight_url: "https://mlb.com/video/yankees-recap",
        },
        error: null,
      },
    });

    const result = await resendLatestRecapAction(null, null);

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/778899/);
    expect(hoisted.sendEmailImpl).toHaveBeenCalledTimes(1);
    const [to, subject, html] = hoisted.sendEmailImpl.mock.calls[0];
    expect(to).toBe(ADMIN_EMAIL);
    expect(subject.startsWith("[TEST] ")).toBe(true);
    expect(subject).toContain("New York Yankees Highlights");
    expect(html).toContain("New York Yankees");
    expect(html).toContain("https://mlb.com/video/yankees-recap");
  });

  it("is blocked when EMAILS_PAUSED is set", async () => {
    process.env.EMAILS_PAUSED = "true";
    hoisted.adminSupabase = makeSupabaseStub({});

    const result = await resendLatestRecapAction(null, null);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/paused/i);
    expect(hoisted.sendEmailImpl).not.toHaveBeenCalled();
  });
});
