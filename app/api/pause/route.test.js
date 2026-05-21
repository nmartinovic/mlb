import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.fn();
const fromMock = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

function makeRequest(body) {
  return new Request("http://localhost/api/pause", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockReturnValue({ error: null });
  fromMock.mockReturnValue({ upsert: upsertMock });
  createAdminClient.mockReturnValue({ from: fromMock });
});

describe("POST /api/pause", () => {
  it("returns 400 when the token is missing", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Missing token" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is an empty string", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ token: "" }));

    expect(res.status).toBe(400);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("upserts a 7-day pause for the token and returns ok", async () => {
    const before = Date.now();
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ token: "user-abc" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("mlb_user_preferences");
    expect(upsertMock).toHaveBeenCalledTimes(1);

    const [row, options] = upsertMock.mock.calls[0];
    expect(row.user_id).toBe("user-abc");
    expect(options).toEqual({ onConflict: "user_id" });

    // notifications_paused_until lands ~7 days out.
    const pausedUntil = Date.parse(row.notifications_paused_until);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(pausedUntil).toBeGreaterThanOrEqual(before + sevenDays);
    expect(pausedUntil).toBeLessThanOrEqual(Date.now() + sevenDays);
  });

  it("returns 500 when the supabase upsert fails", async () => {
    upsertMock.mockReturnValueOnce({ error: { message: "boom" } });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ token: "user-abc" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed" });
  });
});
