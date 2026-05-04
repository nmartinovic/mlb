import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const createClient = vi.fn();
const getCloudflareContext = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args) => createClient(...args),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => getCloudflareContext(),
}));

function makeRequest(body, { headers = {} } = {}) {
  const init = {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request("https://ninthinning.email/api/login", init);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  delete process.env.SITE_URL;
  signInWithOtp.mockResolvedValue({ error: null });
  createClient.mockReturnValue({ auth: { signInWithOtp } });
  getCloudflareContext.mockReturnValue({ env: {} });
});

describe("POST /api/login", () => {
  it("rejects malformed JSON with 400", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest("not-json"));

    expect(res.status).toBe(400);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects an obviously invalid email with 400", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ email: "not-an-email" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid email" });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects a missing email with 400", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-IP limiter rejects", async () => {
    const ipLimiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    const emailLimiter = { limit: vi.fn() };
    getCloudflareContext.mockReturnValue({
      env: { LOGIN_IP_LIMITER: ipLimiter, LOGIN_EMAIL_LIMITER: emailLimiter },
    });
    const { POST } = await import("./route");

    const res = await POST(
      makeRequest({ email: "user@example.com" }, { headers: { "cf-connecting-ip": "1.2.3.4" } })
    );

    expect(res.status).toBe(429);
    expect(ipLimiter.limit).toHaveBeenCalledWith({ key: "ip:1.2.3.4" });
    expect(emailLimiter.limit).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-email limiter rejects", async () => {
    const ipLimiter = { limit: vi.fn().mockResolvedValue({ success: true }) };
    const emailLimiter = { limit: vi.fn().mockResolvedValue({ success: false }) };
    getCloudflareContext.mockReturnValue({
      env: { LOGIN_IP_LIMITER: ipLimiter, LOGIN_EMAIL_LIMITER: emailLimiter },
    });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ email: "User@Example.com" }));

    expect(res.status).toBe(429);
    expect(emailLimiter.limit).toHaveBeenCalledWith({
      key: "email:user@example.com",
    });
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("calls Supabase signInWithOtp with normalized email and returns ok on success", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ email: "  User@Example.com  " }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "https://ninthinning.email/auth/callback",
      },
    });
  });

  it("uses SITE_URL for emailRedirectTo when set, regardless of request origin", async () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const { POST } = await import("./route");

    const req = new Request("https://mlb.workers.dev/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "https://ninthinning.email/auth/callback",
      },
    });
  });

  it("propagates Supabase errors as 400", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { message: "rate limited" } });
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ email: "user@example.com" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "rate limited" });
  });

  it("works when no rate limiter bindings are present", async () => {
    const { POST } = await import("./route");

    const res = await POST(makeRequest({ email: "user@example.com" }));

    expect(res.status).toBe(200);
    expect(signInWithOtp).toHaveBeenCalledTimes(1);
  });
});
