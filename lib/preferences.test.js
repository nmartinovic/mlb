import { describe, expect, it } from "vitest";
import { PAUSE_INDEFINITELY, pauseState, sevenDayPauseUntil } from "./preferences";

const NOW = Date.parse("2026-05-21T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("sevenDayPauseUntil", () => {
  it("returns an ISO timestamp exactly 7 days after now", () => {
    const out = sevenDayPauseUntil(NOW);
    expect(out).toBe(new Date(NOW + 7 * DAY).toISOString());
    expect(Date.parse(out) - NOW).toBe(7 * DAY);
  });
});

describe("pauseState", () => {
  it("treats null/undefined as active", () => {
    expect(pauseState(null, NOW)).toBe("active");
    expect(pauseState(undefined, NOW)).toBe("active");
  });

  it("treats a past timestamp as active (the pause has expired)", () => {
    expect(pauseState(new Date(NOW - DAY).toISOString(), NOW)).toBe("active");
  });

  it("treats an unparseable value as active rather than throwing", () => {
    expect(pauseState("not a date", NOW)).toBe("active");
  });

  it("classifies a 7-day pause as timed", () => {
    expect(pauseState(sevenDayPauseUntil(NOW), NOW)).toBe("timed");
  });

  it("classifies the far-future sentinel as indefinite", () => {
    expect(pauseState(PAUSE_INDEFINITELY, NOW)).toBe("indefinite");
  });

  it("classifies the sentinel as indefinite even after timestamptz reformatting", () => {
    // Postgres returns timestamptz as e.g. "9999-12-31T00:00:00+00:00" — a
    // different string than the stored sentinel, but the same instant.
    expect(pauseState("9999-12-31T00:00:00+00:00", NOW)).toBe("indefinite");
  });
});
