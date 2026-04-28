import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteMock = vi.fn();
const eqMock = vi.fn();
const fromMock = vi.fn();
const createAdminClient = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

function makeRequest(body) {
  return new Request("http://localhost/api/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  eqMock.mockReturnValue({ error: null });
  deleteMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ delete: deleteMock });
  createAdminClient.mockReturnValue({ from: fromMock });
});

describe("POST /api/unsubscribe", () => {
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

  it("deletes mlb_user_teams rows for the token and returns ok", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ token: "user-abc" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("mlb_user_teams");
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledWith("user_id", "user-abc");
  });

  it("returns 500 when the supabase delete fails", async () => {
    eqMock.mockReturnValueOnce({ error: { message: "boom" } });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ token: "user-abc" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed" });
  });
});
