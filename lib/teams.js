// All 30 MLB teams with their Stats API team IDs and brand colors
export const MLB_TEAMS = [
  { id: 109, name: "Arizona Diamondbacks", abbr: "ARI", color: "#A71930" },
  { id: 144, name: "Atlanta Braves", abbr: "ATL", color: "#CE1141" },
  { id: 110, name: "Baltimore Orioles", abbr: "BAL", color: "#DF4601" },
  { id: 111, name: "Boston Red Sox", abbr: "BOS", color: "#BD3039" },
  { id: 112, name: "Chicago Cubs", abbr: "CHC", color: "#0E3386" },
  { id: 145, name: "Chicago White Sox", abbr: "CWS", color: "#27251F" },
  { id: 113, name: "Cincinnati Reds", abbr: "CIN", color: "#C6011F" },
  { id: 114, name: "Cleveland Guardians", abbr: "CLE", color: "#00385D" },
  { id: 115, name: "Colorado Rockies", abbr: "COL", color: "#333366" },
  { id: 116, name: "Detroit Tigers", abbr: "DET", color: "#0C2340" },
  { id: 117, name: "Houston Astros", abbr: "HOU", color: "#002D62" },
  { id: 118, name: "Kansas City Royals", abbr: "KC", color: "#004687" },
  { id: 108, name: "Los Angeles Angels", abbr: "LAA", color: "#BA0021" },
  { id: 119, name: "Los Angeles Dodgers", abbr: "LAD", color: "#005A9C" },
  { id: 146, name: "Miami Marlins", abbr: "MIA", color: "#00A3E0" },
  { id: 158, name: "Milwaukee Brewers", abbr: "MIL", color: "#FFC52F" },
  { id: 142, name: "Minnesota Twins", abbr: "MIN", color: "#002B5C" },
  { id: 121, name: "New York Mets", abbr: "NYM", color: "#002D72" },
  { id: 147, name: "New York Yankees", abbr: "NYY", color: "#003087" },
  { id: 133, name: "Oakland Athletics", abbr: "OAK", color: "#003831" },
  { id: 143, name: "Philadelphia Phillies", abbr: "PHI", color: "#E81828" },
  { id: 134, name: "Pittsburgh Pirates", abbr: "PIT", color: "#27251F" },
  { id: 135, name: "San Diego Padres", abbr: "SD", color: "#2F241D" },
  { id: 137, name: "San Francisco Giants", abbr: "SF", color: "#FD5A1E" },
  { id: 136, name: "Seattle Mariners", abbr: "SEA", color: "#0C2C56" },
  { id: 138, name: "St. Louis Cardinals", abbr: "STL", color: "#C41E3A" },
  { id: 139, name: "Tampa Bay Rays", abbr: "TB", color: "#092C5C" },
  { id: 140, name: "Texas Rangers", abbr: "TEX", color: "#003278" },
  { id: 141, name: "Toronto Blue Jays", abbr: "TOR", color: "#134A8E" },
  { id: 120, name: "Washington Nationals", abbr: "WSH", color: "#AB0003" },
];

export const TEAMS_BY_ID = Object.fromEntries(
  MLB_TEAMS.map((t) => [t.id, t])
);
