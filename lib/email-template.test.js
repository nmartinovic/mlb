import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEmailHtml, buildWelcomeEmailHtml } from "./email-template";

const TEAM = { id: 147, name: "New York Yankees", abbr: "NYY", color: "#003087" };
const HIGHLIGHT_URL = "https://example.com/highlight.mp4";
const USER_ID = "user-123";
const GAME_DATE = "2026-04-27";

describe("buildEmailHtml", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.TIP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("renders the team name, abbreviation, and color", () => {
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);

    expect(html).toContain("New York Yankees");
    expect(html).toContain(">NYY<");
    expect(html).toContain("#003087");
  });

  it("links the watch button to the highlight URL", () => {
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain(`href="${HIGHLIGHT_URL}"`);
  });

  it("formats the game date in long-form US style", () => {
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain("April 27, 2026");
  });

  it("uses SITE_URL for the unsubscribe link", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain(
      `https://ninthinning.email/unsubscribe?token=${USER_ID}`
    );
  });

  it("falls back to NEXT_PUBLIC_SITE_URL when SITE_URL is unset", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com";
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain(
      `https://staging.example.com/unsubscribe?token=${USER_ID}`
    );
  });

  it("accepts explicit siteUrl/tipUrl overrides (Worker scheduled path, #163)", () => {
    // The cron's scheduled handler can't rely on process.env reaching this
    // bundled module — it threads env values explicitly. Junk process.env to
    // prove overrides win.
    process.env.SITE_URL = "https://wrong.example.com";
    process.env.TIP_URL = "https://wrong-tip.example.com";
    const html = buildEmailHtml(
      TEAM,
      HIGHLIGHT_URL,
      USER_ID,
      GAME_DATE,
      null,
      { siteUrl: "https://ninthinning.email", tipUrl: "https://buy.stripe.com/x" }
    );
    expect(html).toContain(`https://ninthinning.email/unsubscribe?token=${USER_ID}`);
    expect(html).toContain("https://buy.stripe.com/x");
    expect(html).not.toContain("wrong.example.com");
    expect(html).not.toContain("wrong-tip.example.com");
  });

  it("includes the tip prompt when TIP_URL is set", () => {
    process.env.TIP_URL = "https://buymeacoffee.com/example";
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);

    expect(html).toContain("Tip the developer");
    expect(html).toContain("https://buymeacoffee.com/example");
  });

  it("omits the tip prompt when TIP_URL is unset", () => {
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);

    expect(html).not.toContain("Tip the developer");
  });

  it("falls back to defaults when team is missing", () => {
    const html = buildEmailHtml(null, HIGHLIGHT_URL, USER_ID, GAME_DATE);

    expect(html).toContain("Your team");
    expect(html).toContain("#2563eb");
  });

  it("always includes the unsubscribe link with the user token", () => {
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain(`/unsubscribe?token=${USER_ID}`);
    expect(html).toContain(">Unsubscribe<");
  });

  it("includes a forward-to-a-fan prompt linking to the site", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain("Forward them this email");
    expect(html).toContain(">ninthinning.email</a>");
    expect(html).toContain('href="https://ninthinning.email"');
  });

  describe("standings strip", () => {
    it("omits the standings block when no standing is provided", () => {
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
      expect(html).not.toContain("Standings entering today");
      expect(html).not.toContain("Wild Card");
    });

    it("renders division rank, record, GB, and WC line for a wild-card team", () => {
      const standing = {
        divisionName: "AL East",
        divisionRank: 2,
        wins: 54,
        losses: 35,
        gamesBack: "2.0",
        wildCardRank: 1,
        wildCardGamesBack: "+6.0",
      };
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, standing);
      expect(html).toContain("Standings entering today");
      expect(html).toContain("AL East");
      expect(html).toContain("<strong>2nd</strong>");
      expect(html).toContain("54&ndash;35");
      expect(html).toContain("2.0 GB");
      expect(html).toContain("Wild Card:");
      expect(html).toContain("<strong>1st</strong>");
      expect(html).toContain("(+6.0)");
    });

    it("drops the wild card line for a division leader", () => {
      const standing = {
        divisionName: "AL East",
        divisionRank: 1,
        wins: 55,
        losses: 32,
        gamesBack: "-",
        wildCardRank: null,
        wildCardGamesBack: "-",
      };
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, standing);
      expect(html).toContain("Standings entering today");
      expect(html).toContain("<strong>1st</strong>");
      expect(html).toContain("55&ndash;32");
      expect(html).not.toContain("Wild Card:");
    });

    it("omits the strip when wins/losses/rank are missing", () => {
      const standing = {
        divisionName: "AL East",
        divisionRank: null,
        wins: null,
        losses: null,
        gamesBack: null,
        wildCardRank: null,
        wildCardGamesBack: null,
      };
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, standing);
      expect(html).not.toContain("Standings entering today");
    });

    it("renders the strip below the Watch Highlights CTA", () => {
      const standing = {
        divisionName: "AL East",
        divisionRank: 2,
        wins: 54,
        losses: 35,
        gamesBack: "2.0",
        wildCardRank: 1,
        wildCardGamesBack: "+6.0",
      };
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, standing);
      const standingsIdx = html.indexOf("Standings entering today");
      const ctaIdx = html.indexOf("Watch Highlights");
      expect(standingsIdx).toBeGreaterThan(-1);
      expect(ctaIdx).toBeGreaterThan(-1);
      expect(standingsIdx).toBeGreaterThan(ctaIdx);
    });
  });
});

describe("buildWelcomeEmailHtml", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.TIP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("includes the one-line welcome and the spoiler-free promise", () => {
    const html = buildWelcomeEmailHtml(USER_ID);
    expect(html).toContain("You&#39;re in.");
    expect(html).toContain(
      "Your spoiler-free recaps start as soon as your team&#39;s next game wraps."
    );
  });

  it("explains post-game timing, no scores in subject/preview, and the highlight link", () => {
    const html = buildWelcomeEmailHtml(USER_ID);
    expect(html.toLowerCase()).toContain("final out");
    expect(html.toLowerCase()).toContain("subject");
    expect(html.toLowerCase()).toContain("score");
    expect(html.toLowerCase()).toContain("highlight");
  });

  it("links the CTA back to /dashboard on SITE_URL", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildWelcomeEmailHtml(USER_ID);
    expect(html).toContain('href="https://ninthinning.email/dashboard"');
    expect(html).toContain("Manage your teams");
  });

  it("includes unsubscribe link with user token", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildWelcomeEmailHtml(USER_ID);
    expect(html).toContain(
      `https://ninthinning.email/unsubscribe?token=${USER_ID}`
    );
    expect(html).toContain(">Unsubscribe<");
  });

  it("includes the non-affiliation disclaimer and brand sender block", () => {
    const html = buildWelcomeEmailHtml(USER_ID);
    expect(html).toContain("Ninth Inning Email");
    expect(html).toContain("not affiliated with");
  });

  it("includes the tip prompt only when TIP_URL is set", () => {
    let html = buildWelcomeEmailHtml(USER_ID);
    expect(html).not.toContain("Tip the developer");

    process.env.TIP_URL = "https://buymeacoffee.com/example";
    html = buildWelcomeEmailHtml(USER_ID);
    expect(html).toContain("Tip the developer");
    expect(html).toContain("https://buymeacoffee.com/example");
  });

  it("includes a forward-to-a-fan prompt linking to the site", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildWelcomeEmailHtml(USER_ID);
    expect(html).toContain("Forward them this email");
    expect(html).toContain(">ninthinning.email</a>");
    expect(html).toContain('href="https://ninthinning.email"');
  });
});
