import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail, SENDER_NAME } from "./brevo";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.EMAIL_API_KEY = "test-api-key";
  process.env.FROM_EMAIL = "highlights@ninthinning.email";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function makeFetchStub({ ok = true, status = 200, text = "" } = {}) {
  return vi.fn(async () => ({
    ok,
    status,
    text: async () => text,
  }));
}

describe("sendEmail", () => {
  it("posts to the Brevo transactional endpoint", async () => {
    const fetchImpl = makeFetchStub();
    await sendEmail("user@example.com", "subject", "<p>body</p>", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect(init.headers["api-key"]).toBe("test-api-key");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it('sets sender.name to "Ninth Inning Email" so inboxes show the brand', async () => {
    const fetchImpl = makeFetchStub();
    await sendEmail("user@example.com", "subject", "<p>body</p>", { fetchImpl });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.sender.name).toBe("Ninth Inning Email");
    expect(body.sender.name).toBe(SENDER_NAME);
  });

  it("uses FROM_EMAIL env var as the sender address", async () => {
    const fetchImpl = makeFetchStub();
    await sendEmail("user@example.com", "subject", "<p>body</p>", { fetchImpl });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.sender.email).toBe("highlights@ninthinning.email");
  });

  it("forwards recipient, subject, and html into the request body", async () => {
    const fetchImpl = makeFetchStub();
    await sendEmail("fan@example.com", "Yankees Highlights", "<p>watch</p>", {
      fetchImpl,
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.to).toEqual([{ email: "fan@example.com" }]);
    expect(body.subject).toBe("Yankees Highlights");
    expect(body.htmlContent).toBe("<p>watch</p>");
  });

  it("throws with the Brevo status and body excerpt on non-2xx", async () => {
    const fetchImpl = makeFetchStub({
      ok: false,
      status: 401,
      text: "invalid api key",
    });

    await expect(
      sendEmail("user@example.com", "subject", "<p>body</p>", { fetchImpl })
    ).rejects.toThrow("Brevo 401: invalid api key");
  });
});
