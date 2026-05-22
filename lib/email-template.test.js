import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendUtmParams,
  buildAccountDeletedEmailHtml,
  buildEmailHtml,
  buildMultiGameEmailHtml,
  buildWelcomeEmailHtml,
} from "./email-template";

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

  it("points the watch CTA at the branded /highlights/{gamePk} page (#77)", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
      gamePk: 776543,
    });
    expect(html).toContain(
      "https://ninthinning.email/highlights/776543?utm_source=ninthinning"
    );
    expect(html).toContain("utm_medium=email");
    expect(html).toContain("utm_campaign=recap");
    // The raw MLB video URL is no longer in the email — the click routes
    // through our own page, which fetches the highlight itself.
    expect(html).not.toContain(HIGHLIGHT_URL);
  });

  it("falls back to the raw highlight URL when no gamePk is given (#93)", () => {
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain(HIGHLIGHT_URL);
    expect(html).toContain("utm_source=ninthinning");
    expect(html).not.toContain("/highlights/");
  });

  it("preserves any pre-existing UTM params on the fallback highlight URL", () => {
    const url = "https://www.mlb.com/video/abc?utm_source=mlb";
    const html = buildEmailHtml(TEAM, url, USER_ID, GAME_DATE);
    expect(html).toContain("utm_source=mlb");
    expect(html).not.toContain("utm_source=ninthinning");
    expect(html).toContain("utm_medium=email");
    expect(html).toContain("utm_campaign=recap");
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

  it("includes a pause-for-7-days footer link with the user token (#22)", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
    expect(html).toContain(
      `https://ninthinning.email/pause?token=${USER_ID}`
    );
    expect(html).toContain(">Pause for 7 days<");
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

  describe("series context line (#69)", () => {
    const SERIES_HOME = {
      opponentName: "Yankees",
      isHome: true,
      seriesGameNumber: 2,
      gamesInSeries: 3,
    };
    const SERIES_AWAY = {
      opponentName: "Red Sox",
      isHome: false,
      seriesGameNumber: 1,
      gamesInSeries: 4,
    };

    it("renders `vs Opponent — Game X of Y` for a home game", () => {
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
        seriesContext: SERIES_HOME,
      });
      expect(html).toContain("vs Yankees &mdash; Game 2 of 3");
    });

    it("renders `@ Opponent — Game X of Y` for an away game", () => {
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
        seriesContext: SERIES_AWAY,
      });
      expect(html).toContain("@ Red Sox &mdash; Game 1 of 4");
    });

    it("renders the line above the Watch Highlights CTA", () => {
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
        seriesContext: SERIES_HOME,
      });
      const seriesIdx = html.indexOf("vs Yankees");
      const ctaIdx = html.indexOf("Watch Highlights");
      expect(seriesIdx).toBeGreaterThan(-1);
      expect(ctaIdx).toBeGreaterThan(-1);
      expect(seriesIdx).toBeLessThan(ctaIdx);
    });

    it("omits the line when seriesContext is null or undefined", () => {
      const htmlNull = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
        seriesContext: null,
      });
      const htmlUndef = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE);
      for (const html of [htmlNull, htmlUndef]) {
        expect(html).not.toContain("Game 1 of");
        expect(html).not.toContain("Game 2 of");
        expect(html).not.toMatch(/(>|\s)vs [A-Z]/);
        expect(html).not.toMatch(/(>|\s)@ [A-Z]/);
      }
    });

    it("omits the line when opponentName is missing", () => {
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
        seriesContext: { ...SERIES_HOME, opponentName: null },
      });
      expect(html).not.toContain("Game 2 of 3");
    });

    it("omits the line when series numbers are missing or malformed", () => {
      const cases = [
        { ...SERIES_HOME, seriesGameNumber: null },
        { ...SERIES_HOME, gamesInSeries: null },
        { ...SERIES_HOME, seriesGameNumber: 0 },
        { ...SERIES_HOME, gamesInSeries: 0 },
        { ...SERIES_HOME, seriesGameNumber: "two" },
        { ...SERIES_HOME, seriesGameNumber: 5, gamesInSeries: 3 },
      ];
      for (const seriesContext of cases) {
        const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
          seriesContext,
        });
        expect(html).not.toContain("Yankees &mdash; Game");
      }
    });

    it("never leaks score, win/loss, or play-by-play language", () => {
      // "inning" is excluded since it's part of the brand name (Ninth Inning Email).
      const html = buildEmailHtml(TEAM, HIGHLIGHT_URL, USER_ID, GAME_DATE, null, {
        seriesContext: SERIES_HOME,
      });
      const body = html.toLowerCase();
      expect(body).not.toMatch(/\b(score|won|lost|walkoff|walk-off|homer|home run)\b/);
    });
  });
});

describe("buildMultiGameEmailHtml (#27)", () => {
  const originalEnv = { ...process.env };

  const YANKEES = {
    id: 147,
    name: "New York Yankees",
    shortName: "Yankees",
    abbr: "NYY",
    color: "#003087",
  };
  const DODGERS = {
    id: 119,
    name: "Los Angeles Dodgers",
    shortName: "Dodgers",
    abbr: "LAD",
    color: "#005A9C",
  };
  const GAMES = [
    {
      team: YANKEES,
      highlightUrl: "https://www.mlb.com/video/yankees-recap",
      gamePk: 778001,
      gameDate: "2026-05-18",
      standing: {
        divisionName: "AL East",
        divisionRank: 1,
        wins: 28,
        losses: 16,
        gamesBack: "-",
        wildCardRank: null,
        wildCardGamesBack: "-",
      },
      seriesContext: {
        opponentName: "Red Sox",
        isHome: true,
        seriesGameNumber: 2,
        gamesInSeries: 3,
      },
    },
    {
      team: DODGERS,
      highlightUrl: "https://www.mlb.com/video/dodgers-recap",
      gamePk: 778002,
      gameDate: "2026-05-18",
      standing: null,
      seriesContext: {
        opponentName: "Giants",
        isHome: false,
        seriesGameNumber: 1,
        gamesInSeries: 3,
      },
    },
  ];

  beforeEach(() => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.TIP_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("matches the multi-game email snapshot", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    process.env.TIP_URL = "https://buy.stripe.com/tip";
    expect(buildMultiGameEmailHtml(GAMES, USER_ID)).toMatchSnapshot();
  });

  it("renders one card per game with both teams and a per-game recap CTA", () => {
    const html = buildMultiGameEmailHtml(GAMES, USER_ID);
    expect(html).toContain("New York Yankees");
    expect(html).toContain("Los Angeles Dodgers");
    // Each card's CTA points at our branded interstitial, keyed on game_pk (#77).
    expect(html).toContain("/highlights/778001");
    expect(html).toContain("/highlights/778002");
    // One Watch Highlights CTA per game card.
    expect(html.match(/Watch Highlights/g)).toHaveLength(2);
  });

  it("states the recap count in the intro line", () => {
    expect(buildMultiGameEmailHtml(GAMES, USER_ID)).toContain(
      "2 spoiler-free recaps"
    );
  });

  it("appends recap UTM params to every highlight CTA", () => {
    const html = buildMultiGameEmailHtml(GAMES, USER_ID);
    expect(html).toContain("/highlights/778001?utm_source=ninthinning");
    expect(html).toContain("/highlights/778002?utm_source=ninthinning");
  });

  it("carries exactly one unsubscribe and one pause link with the user token", () => {
    process.env.SITE_URL = "https://ninthinning.email";
    const html = buildMultiGameEmailHtml(GAMES, USER_ID);
    expect(html.match(new RegExp(`/unsubscribe\\?token=${USER_ID}`, "g"))).toHaveLength(1);
    expect(html.match(new RegExp(`/pause\\?token=${USER_ID}`, "g"))).toHaveLength(1);
  });

  it("renders the per-game spoiler-safe series and standings context", () => {
    const html = buildMultiGameEmailHtml(GAMES, USER_ID);
    expect(html).toContain("vs Red Sox &mdash; Game 2 of 3");
    expect(html).toContain("@ Giants &mdash; Game 1 of 3");
    expect(html).toContain("Standings entering today");
  });

  it("includes the tip prompt only when TIP_URL is set", () => {
    let html = buildMultiGameEmailHtml(GAMES, USER_ID);
    expect(html).not.toContain("Tip the developer");

    process.env.TIP_URL = "https://buy.stripe.com/tip";
    html = buildMultiGameEmailHtml(GAMES, USER_ID);
    expect(html).toContain("Tip the developer");
    expect(html).toContain("https://buy.stripe.com/tip");
  });

  it("never leaks score, win/loss, or play-by-play language", () => {
    const html = buildMultiGameEmailHtml(GAMES, USER_ID).toLowerCase();
    expect(html).not.toMatch(/\b(score|won|lost|walkoff|walk-off|homer|home run)\b/);
  });

  it("respects siteUrl/tipUrl overrides (Worker scheduled path, #163)", () => {
    process.env.SITE_URL = "https://wrong.example.com";
    process.env.TIP_URL = "https://wrong-tip.example.com";
    const html = buildMultiGameEmailHtml(GAMES, USER_ID, {
      siteUrl: "https://ninthinning.email",
      tipUrl: "https://buy.stripe.com/x",
    });
    expect(html).toContain(`https://ninthinning.email/unsubscribe?token=${USER_ID}`);
    expect(html).toContain("https://buy.stripe.com/x");
    expect(html).not.toContain("wrong.example.com");
    expect(html).not.toContain("wrong-tip.example.com");
  });
});

describe("appendUtmParams", () => {
  it("appends recap UTM params to a bare URL", () => {
    const out = appendUtmParams("https://www.mlb.com/video/abc");
    const parsed = new URL(out);
    expect(parsed.searchParams.get("utm_source")).toBe("ninthinning");
    expect(parsed.searchParams.get("utm_medium")).toBe("email");
    expect(parsed.searchParams.get("utm_campaign")).toBe("recap");
  });

  it("does not overwrite existing UTM keys", () => {
    const out = appendUtmParams("https://www.mlb.com/x?utm_campaign=custom");
    const parsed = new URL(out);
    expect(parsed.searchParams.get("utm_campaign")).toBe("custom");
    expect(parsed.searchParams.get("utm_source")).toBe("ninthinning");
  });

  it("returns the input unchanged when the URL fails to parse", () => {
    expect(appendUtmParams("not a url")).toBe("not a url");
  });

  it("returns null/empty inputs unchanged", () => {
    expect(appendUtmParams("")).toBe("");
    expect(appendUtmParams(null)).toBe(null);
    expect(appendUtmParams(undefined)).toBe(undefined);
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

describe("buildAccountDeletedEmailHtml", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("confirms the account and its data were deleted", () => {
    const html = buildAccountDeletedEmailHtml();
    expect(html).toContain("Your account was deleted");
    expect(html.toLowerCase()).toContain("permanently deleted");
  });

  it("includes the non-affiliation disclaimer", () => {
    const html = buildAccountDeletedEmailHtml();
    expect(html).toContain("not affiliated with");
  });

  it("carries no unsubscribe link or tip prompt (the account is gone)", () => {
    process.env.TIP_URL = "https://buymeacoffee.com/example";
    const html = buildAccountDeletedEmailHtml();
    expect(html).not.toContain("/unsubscribe?token=");
    expect(html).not.toContain("Tip the developer");
  });

  it("links the come-back-anytime prompt to the site URL", () => {
    const html = buildAccountDeletedEmailHtml({ siteUrl: "https://ninthinning.email" });
    expect(html).toContain('href="https://ninthinning.email"');
  });
});
