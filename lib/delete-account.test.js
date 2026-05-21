import { describe, expect, it, vi } from "vitest";
import { deleteAccount } from "./delete-account";

function makeAdminStub({ deleteError = null } = {}) {
  const deleteCalls = [];
  return {
    auth: {
      admin: {
        deleteUser: (id) => {
          deleteCalls.push(id);
          return Promise.resolve({ data: {}, error: deleteError });
        },
      },
    },
    _calls: { deleteCalls },
  };
}

describe("deleteAccount", () => {
  it("deletes the auth user and sends the confirmation email", async () => {
    const admin = makeAdminStub();
    const sendImpl = vi.fn(async () => undefined);

    const result = await deleteAccount({
      admin,
      userId: "u1",
      email: "fan@example.com",
      sendImpl,
    });

    expect(result).toEqual({ deleted: true, emailSent: true });
    expect(admin._calls.deleteCalls).toEqual(["u1"]);
    expect(sendImpl).toHaveBeenCalledTimes(1);
    const [to, subject, html] = sendImpl.mock.calls[0];
    expect(to).toBe("fan@example.com");
    expect(subject).toMatch(/deleted/i);
    expect(html).toContain("Your account was deleted");
  });

  it("throws when the admin delete fails and never sends an email", async () => {
    const admin = makeAdminStub({ deleteError: { message: "user not found" } });
    const sendImpl = vi.fn();

    await expect(
      deleteAccount({ admin, userId: "u1", email: "fan@example.com", sendImpl })
    ).rejects.toThrow(/user not found/);

    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("still reports success when the confirmation email fails (best-effort)", async () => {
    const admin = makeAdminStub();
    const sendImpl = vi.fn(async () => {
      throw new Error("Brevo 500: boom");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await deleteAccount({
      admin,
      userId: "u1",
      email: "fan@example.com",
      sendImpl,
    });

    expect(result).toEqual({ deleted: true, emailSent: false });
    expect(admin._calls.deleteCalls).toEqual(["u1"]);
    errorSpy.mockRestore();
  });

  it("skips the confirmation email when the user has no email", async () => {
    const admin = makeAdminStub();
    const sendImpl = vi.fn();

    const result = await deleteAccount({
      admin,
      userId: "u1",
      email: null,
      sendImpl,
    });

    expect(result).toEqual({ deleted: true, emailSent: false });
    expect(sendImpl).not.toHaveBeenCalled();
  });
});
