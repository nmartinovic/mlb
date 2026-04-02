// All 30 MLB teams with their Stats API team IDs
export const MLB_TEAMS = [
  { id: 109, name: "Arizona Diamondbacks", abbr: "ARI" },
  { id: 144, name: "Atlanta Braves", abbr: "ATL" },
  { id: 110, name: "Baltimore Orioles", abbr: "BAL" },
  { id: 111, name: "Boston Red Sox", abbr: "BOS" },
  { id: 112, name: "Chicago Cubs", abbr: "CHC" },
  { id: 145, name: "Chicago White Sox", abbr: "CWS" },
  { id: 113, name: "Cincinnati Reds", abbr: "CIN" },
  { id: 114, name: "Cleveland Guardians", abbr: "CLE" },
  { id: 115, name: "Colorado Rockies", abbr: "COL" },
  { id: 116, name: "Detroit Tigers", abbr: "DET" },
  { id: 117, name: "Houston Astros", abbr: "HOU" },
  { id: 118, name: "Kansas City Royals", abbr: "KC" },
  { id: 108, name: "Los Angeles Angels", abbr: "LAA" },
  { id: 119, name: "Los Angeles Dodgers", abbr: "LAD" },
  { id: 146, name: "Miami Marlins", abbr: "MIA" },
  { id: 158, name: "Milwaukee Brewers", abbr: "MIL" },
  { id: 142, name: "Minnesota Twins", abbr: "MIN" },
  { id: 121, name: "New York Mets", abbr: "NYM" },
  { id: 147, name: "New York Yankees", abbr: "NYY" },
  { id: 133, name: "Oakland Athletics", abbr: "OAK" },
  { id: 143, name: "Philadelphia Phillies", abbr: "PHI" },
  { id: 134, name: "Pittsburgh Pirates", abbr: "PIT" },
  { id: 135, name: "San Diego Padres", abbr: "SD" },
  { id: 137, name: "San Francisco Giants", abbr: "SF" },
  { id: 136, name: "Seattle Mariners", abbr: "SEA" },
  { id: 138, name: "St. Louis Cardinals", abbr: "STL" },
  { id: 139, name: "Tampa Bay Rays", abbr: "TB" },
  { id: 140, name: "Texas Rangers", abbr: "TEX" },
  { id: 141, name: "Toronto Blue Jays", abbr: "TOR" },
  { id: 120, name: "Washington Nationals", abbr: "WSH" },
];

export const TEAMS_BY_ID = Object.fromEntries(
  MLB_TEAMS.map((t) => [t.id, t])
);
