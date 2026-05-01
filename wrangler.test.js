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
