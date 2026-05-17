import { describe, it, expect } from "vitest";
import {
  REQUIRED_SECRETS,
  OPTIONAL_SECRETS,
  verifySecrets,
  parseWranglerSecretList,
} from "./verify-secrets.mjs";

// Issue #166. Postmortem #164 landed because two Supabase secrets were missing
// from the runtime store. The deploy-time check has to fail loudly on missing
// required secrets, but tolerate optional ones being absent and unexpected
// extras (so an in-flight rotation doesn't block a deploy).

// Real `wrangler secret list --format json` output shape.
function wranglerOutput(names) {
  return JSON.stringify(names.map((name) => ({ name, type: "secret_text" })));
}

describe("parseWranglerSecretList", () => {
  it("extracts secret names from wrangler's JSON output", () => {
    const stdout = wranglerOutput(["CRON_SECRET", "EMAIL_API_KEY"]);
    expect(parseWranglerSecretList(stdout)).toEqual([
      "CRON_SECRET",
      "EMAIL_API_KEY",
    ]);
  });

  it("returns an empty list when no secrets are set", () => {
    expect(parseWranglerSecretList("[]")).toEqual([]);
  });

  it("throws on non-array JSON", () => {
    expect(() => parseWranglerSecretList('{"oops":true}')).toThrow();
  });
});

describe("verifySecrets", () => {
  it("passes when every required secret is present", () => {
    const stdout = wranglerOutput([...REQUIRED_SECRETS]);
    const { missing, extra } = verifySecrets(parseWranglerSecretList(stdout));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("flags the Supabase NEXT_PUBLIC_* secrets when they're missing — the exact #164 regression", () => {
    const stdout = wranglerOutput(
      REQUIRED_SECRETS.filter(
        (n) =>
          n !== "NEXT_PUBLIC_SUPABASE_URL" &&
          n !== "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ),
    );
    const { missing } = verifySecrets(parseWranglerSecretList(stdout));
    expect(missing).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(missing).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("tolerates optional secrets being absent", () => {
    const stdout = wranglerOutput([...REQUIRED_SECRETS]);
    const { missing, extra } = verifySecrets(parseWranglerSecretList(stdout));
    for (const opt of OPTIONAL_SECRETS) {
      expect(missing).not.toContain(opt);
      expect(extra).not.toContain(opt);
    }
  });

  it("accepts optional secrets when present", () => {
    const stdout = wranglerOutput([
      ...REQUIRED_SECRETS,
      "NEXT_PUBLIC_POSTHOG_KEY",
      "EMAILS_PAUSED",
    ]);
    const { missing, extra } = verifySecrets(parseWranglerSecretList(stdout));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("reports unknown secrets as extras without failing the required-check", () => {
    const stdout = wranglerOutput([...REQUIRED_SECRETS, "LEFTOVER_FROM_OLD_FEATURE"]);
    const { missing, extra } = verifySecrets(parseWranglerSecretList(stdout));
    expect(missing).toEqual([]);
    expect(extra).toEqual(["LEFTOVER_FROM_OLD_FEATURE"]);
  });

  it("returns missing secrets in a stable, named order so the failure message names them", () => {
    const { missing } = verifySecrets([]);
    expect(missing).toEqual(REQUIRED_SECRETS);
  });
});
