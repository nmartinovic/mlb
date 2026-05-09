import { describe, expect, it } from "vitest";
import { MLB_TEAMS, TEAMS_BY_ID } from "./teams";

describe("MLB_TEAMS", () => {
  it("contains exactly 30 teams", () => {
    expect(MLB_TEAMS).toHaveLength(30);
  });

  it("gives every team an id, name, shortName, abbr, and a hex color", () => {
    for (const team of MLB_TEAMS) {
      expect(typeof team.id).toBe("number");
      expect(team.name).toBeTruthy();
      expect(team.shortName).toBeTruthy();
      expect(team.name).toContain(team.shortName);
      expect(team.abbr).toBeTruthy();
      expect(team.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("has unique ids", () => {
    const ids = MLB_TEAMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique abbreviations", () => {
    const abbrs = MLB_TEAMS.map((t) => t.abbr);
    expect(new Set(abbrs).size).toBe(abbrs.length);
  });

  it("has unique team names", () => {
    const names = MLB_TEAMS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("TEAMS_BY_ID", () => {
  it("indexes every team by id", () => {
    expect(Object.keys(TEAMS_BY_ID)).toHaveLength(MLB_TEAMS.length);
    for (const team of MLB_TEAMS) {
      expect(TEAMS_BY_ID[team.id]).toBe(team);
    }
  });

  it("returns undefined for unknown ids", () => {
    expect(TEAMS_BY_ID[0]).toBeUndefined();
    expect(TEAMS_BY_ID[999999]).toBeUndefined();
  });
});
