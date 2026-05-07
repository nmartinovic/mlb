import { describe, expect, it, vi } from "vitest";
import {
  sendWelcomeEmailIfNeeded,
  WELCOME_SENTINEL_GAME_PK,
} from "./welcome-email";

function makeSupabaseStub({ insertError = null } = {}) {
  const insertCalls = [];
  const deleteCalls = [];

  const fromImpl = (table) => {
    if (table !== "mlb_sent_notifications") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      insert: (row) => {
        insertCalls.push(row);
        return Promise.resolve({ error: insertError });
      },
      delete: () => {
        const filter = {};
        const chain = {
          eq: (col, val) => {
            filter[col] = val;
            return chain;
          },
          then: (resolve) => {
            deleteCalls.push(filter);
            resolve({ error: null });
          },
        };
        return chain;
      },
    };
  };

  return {
    from: fromImpl,
    _calls: { insertCalls, deleteCalls },
  };
}

describe("sendWelcomeEmailIfNeeded", () => {
  it("returns no_email when email is missing", async () => {
    const supabase = makeSupabaseStub();
    const sendImpl = vi.fn();
    const result = await sendWelcomeEmailIfNeeded({
      supabase,
      userId: "u1",
      email: null,
      sendImpl,
    });
    expect(result).toEqual({ sent: false, reason: "no_email" });
    expect(sendImpl).not.toHaveBeenCalled();
    expect(supabase._calls.insertCalls).toHaveLength(0);
  });

  it("inserts the sentinel and sends on the first call", async () => {
    const supabase = makeSupabaseStub();
    const sendImpl = vi.fn(async () => undefined);

    const result = await sendWelcomeEmailIfNeeded({
      supabase,
      userId: "u1",
      email: "fan@example.com",
      sendImpl,
    });

    expect(result).toEqual({ sent: true });
    expect(supabase._calls.insertCalls).toEqual([
      { user_id: "u1", game_pk: WELCOME_SENTINEL_GAME_PK },
    ]);
    expect(sendImpl).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendImpl.mock.calls[0];
    expect(to).toBe("fan@example.com");
    expect(subject).toMatch(/welcome/i);
    expect(html).toContain("You&#39;re in.");
  });

  it("skips sending when the sentinel already exists (unique-violation 23505)", async () => {
    const supabase = makeSupabaseStub({
      insertError: { code: "23505", message: "duplicate key" },
    });
    const sendImpl = vi.fn();

    const result = await sendWelcomeEmailIfNeeded({
      supabase,
      userId: "u1",
      email: "fan@example.com",
      sendImpl,
    });

    expect(result).toEqual({ sent: false, reason: "already_sent" });
    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("rolls back the sentinel when send fails so the next attempt can retry", async () => {
    const supabase = makeSupabaseStub();
    const sendImpl = vi.fn(async () => {
      throw new Error("Brevo 500: boom");
    });

    await expect(
      sendWelcomeEmailIfNeeded({
        supabase,
        userId: "u1",
        email: "fan@example.com",
        sendImpl,
      })
    ).rejects.toThrow("Brevo 500: boom");

    expect(supabase._calls.insertCalls).toHaveLength(1);
    expect(supabase._calls.deleteCalls).toEqual([
      { user_id: "u1", game_pk: WELCOME_SENTINEL_GAME_PK },
    ]);
  });

  it("propagates non-conflict insert errors without sending", async () => {
    const supabase = makeSupabaseStub({
      insertError: { code: "42P01", message: "relation missing" },
    });
    const sendImpl = vi.fn();

    await expect(
      sendWelcomeEmailIfNeeded({
        supabase,
        userId: "u1",
        email: "fan@example.com",
        sendImpl,
      })
    ).rejects.toThrow(/relation missing/);

    expect(sendImpl).not.toHaveBeenCalled();
  });
});
