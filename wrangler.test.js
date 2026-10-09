import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const wranglerPath = fileURLToPath(new URL("./wrangler.jsonc", import.meta.url));

function parseJsonc(text) {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"])\/\/.*$/gm, "$1");
  return JSON.parse(stripped);
}

describe("wrangler.jsonc", () => {
  const config = parseJsonc(readFileSync(wranglerPath, "utf8"));

  it("defines TIP_URL so the tip block renders in production emails", () => {
    expect(config.vars?.TIP_URL).toMatch(/^https:\/\/buy\.stripe\.com\//);
  });

  it("keeps SITE_URL and FROM_EMAIL pointed at ninthinning.email", () => {
    expect(config.vars?.SITE_URL).toBe("https://ninthinning.email");
    expect(config.vars?.FROM_EMAIL).toBe("highlights@ninthinning.email");
  });

  it("injects the cron handler and populates the static page cache on every deploy", () => {
    // Production deploys via plain `wrangler deploy`, which skips OpenNext's
    // own cache population — without it prerendered pages re-render on every
    // request (over the Free plan's 10ms CPU budget) and /teams/* 404s.
    expect(config.build?.command).toContain("node scripts/inject-scheduled.mjs");
    expect(config.build?.command).toContain("node scripts/populate-static-cache.mjs");
  });

  it("wires both the 15-min main cron and the 9am ET scheduler (#76)", () => {
    expect(config.triggers?.crons).toEqual(["*/15 * * * *", "0 13 * * *"]);
  });

  it("declares per-IP and per-email rate limit bindings for /api/login (#25)", () => {
    const bindings = config.unsafe?.bindings ?? [];
    const byName = Object.fromEntries(bindings.map((b) => [b.name, b]));

    expect(byName.LOGIN_IP_LIMITER).toMatchObject({
      type: "ratelimit",
      simple: { limit: 5, period: 60 },
    });
    expect(byName.LOGIN_EMAIL_LIMITER).toMatchObject({
      type: "ratelimit",
      simple: { limit: 3, period: 60 },
    });
  });
});
