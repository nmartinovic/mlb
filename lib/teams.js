// All 30 MLB teams with their Stats API team IDs and brand colors.
// `slug` is the URL identifier used by /teams/[slug] landing pages (#195).
// Derived from shortName: lowercased, spaces → hyphens. Stable — once a slug
// is shipped it is part of the site's URL surface and cannot change without a
// redirect.
export const MLB_TEAMS = [
  { id: 109, name: "Arizona Diamondbacks", shortName: "Diamondbacks", abbr: "ARI", color: "#A71930", slug: "diamondbacks" },
  { id: 144, name: "Atlanta Braves", shortName: "Braves", abbr: "ATL", color: "#CE1141", slug: "braves" },
  { id: 110, name: "Baltimore Orioles", shortName: "Orioles", abbr: "BAL", color: "#DF4601", slug: "orioles" },
  { id: 111, name: "Boston Red Sox", shortName: "Red Sox", abbr: "BOS", color: "#BD3039", slug: "red-sox" },
  { id: 112, name: "Chicago Cubs", shortName: "Cubs", abbr: "CHC", color: "#0E3386", slug: "cubs" },
  { id: 145, name: "Chicago White Sox", shortName: "White Sox", abbr: "CWS", color: "#27251F", slug: "white-sox" },
  { id: 113, name: "Cincinnati Reds", shortName: "Reds", abbr: "CIN", color: "#C6011F", slug: "reds" },
  { id: 114, name: "Cleveland Guardians", shortName: "Guardians", abbr: "CLE", color: "#00385D", slug: "guardians" },
  { id: 115, name: "Colorado Rockies", shortName: "Rockies", abbr: "COL", color: "#333366", slug: "rockies" },
  { id: 116, name: "Detroit Tigers", shortName: "Tigers", abbr: "DET", color: "#0C2340", slug: "tigers" },
  { id: 117, name: "Houston Astros", shortName: "Astros", abbr: "HOU", color: "#002D62", slug: "astros" },
  { id: 118, name: "Kansas City Royals", shortName: "Royals", abbr: "KC", color: "#004687", slug: "royals" },
  { id: 108, name: "Los Angeles Angels", shortName: "Angels", abbr: "LAA", color: "#BA0021", slug: "angels" },
  { id: 119, name: "Los Angeles Dodgers", shortName: "Dodgers", abbr: "LAD", color: "#005A9C", slug: "dodgers" },
  { id: 146, name: "Miami Marlins", shortName: "Marlins", abbr: "MIA", color: "#00A3E0", slug: "marlins" },
  { id: 158, name: "Milwaukee Brewers", shortName: "Brewers", abbr: "MIL", color: "#FFC52F", slug: "brewers" },
  { id: 142, name: "Minnesota Twins", shortName: "Twins", abbr: "MIN", color: "#002B5C", slug: "twins" },
  { id: 121, name: "New York Mets", shortName: "Mets", abbr: "NYM", color: "#002D72", slug: "mets" },
  { id: 147, name: "New York Yankees", shortName: "Yankees", abbr: "NYY", color: "#003087", slug: "yankees" },
  { id: 133, name: "Oakland Athletics", shortName: "Athletics", abbr: "OAK", color: "#003831", slug: "athletics" },
  { id: 143, name: "Philadelphia Phillies", shortName: "Phillies", abbr: "PHI", color: "#E81828", slug: "phillies" },
  { id: 134, name: "Pittsburgh Pirates", shortName: "Pirates", abbr: "PIT", color: "#27251F", slug: "pirates" },
  { id: 135, name: "San Diego Padres", shortName: "Padres", abbr: "SD", color: "#2F241D", slug: "padres" },
  { id: 137, name: "San Francisco Giants", shortName: "Giants", abbr: "SF", color: "#FD5A1E", slug: "giants" },
  { id: 136, name: "Seattle Mariners", shortName: "Mariners", abbr: "SEA", color: "#0C2C56", slug: "mariners" },
  { id: 138, name: "St. Louis Cardinals", shortName: "Cardinals", abbr: "STL", color: "#C41E3A", slug: "cardinals" },
  { id: 139, name: "Tampa Bay Rays", shortName: "Rays", abbr: "TB", color: "#092C5C", slug: "rays" },
  { id: 140, name: "Texas Rangers", shortName: "Rangers", abbr: "TEX", color: "#003278", slug: "rangers" },
  { id: 141, name: "Toronto Blue Jays", shortName: "Blue Jays", abbr: "TOR", color: "#134A8E", slug: "blue-jays" },
  { id: 120, name: "Washington Nationals", shortName: "Nationals", abbr: "WSH", color: "#AB0003", slug: "nationals" },
];

export const TEAMS_BY_ID = Object.fromEntries(
  MLB_TEAMS.map((t) => [t.id, t])
);

export const TEAMS_BY_SLUG = Object.fromEntries(
  MLB_TEAMS.map((t) => [t.slug, t])
);
