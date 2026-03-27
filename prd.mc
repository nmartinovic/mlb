# PRD: Mariners Highlights Emailer

## Overview

A GitHub Actions–powered service that automatically sends a spoiler-free email containing a direct link to the Seattle Mariners' daily game highlights video (~2–5 min recap) from MLB.com.

**Problem:** Navigating to MLB.com to find highlight videos exposes the user to scores, outcomes, and other spoilers before they can watch the game.

**Solution:** A scheduled pipeline that fetches the highlight video URL and delivers it via email with zero game context — no scores, no win/loss, no player-of-the-game language.

---

## Functional Requirements

### 1. Fetch Mariners Schedule & Game Status

- Use the **MLB Stats API** (`statsapi.mlb.com`) to check whether the Mariners played today and whether the game is final.
  - **Team ID:** Seattle Mariners = `136`
  - **Schedule endpoint:** `https://statsapi.mlb.com/api/v1/schedule?teamId=136&date=YYYY-MM-DD&sportId=1&hydrate=game(content(highlights(highlights(items))))`
  - This endpoint returns game content including highlight video metadata when `hydrate` includes content highlights.
- If no game today or game is not yet final, exit gracefully (no email sent).
- Handle doubleheaders: if two games, send links for both.

### 2. Extract Highlight Video URL

- From the hydrated schedule response, locate the **condensed game** or **game highlights** video (typically titled something like "Recap: SEA X, OPP Y" — but we strip all of this).
- The video items in the API response contain `playbacks` arrays with URLs at different resolutions. Extract the highest-quality `mp4` URL available, or fall back to the MLB.com content page URL.
- **Fallback strategy:** If the highlights API field is empty (MLB sometimes delays posting), retry up to 3 times with a 15-minute wait between attempts. If still unavailable after retries, send an email saying "Highlights not yet available — check back later" with a generic link to `https://www.mlb.com/mariners/video`.
- **Important:** Explore the actual API response structure during implementation. The `hydrate` parameter and response nesting may need adjustment. Use `https://statsapi.mlb.com/api/v1/schedule?teamId=136&date=2025-03-27&sportId=1` as a starting point and inspect what content/highlights fields are available. The exact path to video URLs may differ from what's documented above — treat the above as a starting hypothesis, not gospel.

### 3. Send Spoiler-Free Email

- **Email content must contain ONLY:**
  - A subject line: `"Mariners Highlights — [Month Day, Year]"` (e.g., "Mariners Highlights — March 27, 2026")
  - A brief body: `"Today's Mariners highlights are ready."` followed by the direct video link.
  - No scores. No opponent name. No "walk-off" or "shutout" or any outcome-revealing language.
- **Email delivery:** Use a lightweight transactional email service. Options in order of preference:
  1. **Resend** (generous free tier, simple API, one HTTP call)
  2. **SendGrid** (free tier available)
  3. **Gmail SMTP via nodemailer** (if the user prefers not to add another service)
- Recipient email address stored as a GitHub Actions secret (`RECIPIENT_EMAIL`).

### 4. GitHub Actions Workflow

- **Trigger:** `schedule` cron.
  - During MLB regular season + postseason (roughly late March through October):
    - Run every 30 minutes from **02:00 UTC to 08:00 UTC** (covers ~7 PM–1 AM PT, when most Mariners home/away games end).
    - A secondary run at **09:00 UTC** as a catch-all for late West Coast games.
  - Off-season: disable the schedule or let it run (it'll just find no games and exit).
- **Deduplication:** The workflow must track whether an email has already been sent for a given game ID to avoid duplicate emails. Options:
  - Use a simple **JSON file committed to the repo** (`sent-games.json`) that logs game IDs already emailed. The workflow reads it, checks, and commits a new entry if an email is sent.
  - Alternatively, use **GitHub Actions cache** with the game ID as key.
- **Secrets required:**
  - `RECIPIENT_EMAIL` — destination email address
  - `EMAIL_API_KEY` — API key for whichever email service is chosen
  - `FROM_EMAIL` — sender address (if required by the email service)

---

## Technical Architecture

```
GitHub Actions (cron schedule)
       │
       ▼
  Node.js script
       │
       ├── 1. GET MLB Stats API → check if Mariners game is final
       │
       ├── 2. Extract highlight video URL from response
       │
       ├── 3. Check sent-games.json → skip if already emailed
       │
       ├── 4. Send email via Resend/SendGrid/SMTP
       │
       └── 5. Update sent-games.json, commit
```

### Language & Runtime

- **Node.js** (runs natively in GitHub Actions with zero setup)
- Minimal dependencies: just `node-fetch` (or native fetch in Node 18+) and the email SDK.
- Single script file is fine — this is intentionally simple.

### Project Structure

```
mariners-highlights-emailer/
├── .github/
│   └── workflows/
│       └── highlights.yml        # GitHub Actions workflow
├── src/
│   └── index.js                  # Main script
├── sent-games.json               # Deduplication log (committed to repo)
├── package.json
└── README.md
```

---

## Non-Functional Requirements

- **Reliability:** Retry logic for both API fetching and email sending. Log errors clearly in GitHub Actions output.
- **Cost:** $0. MLB Stats API is free/public. GitHub Actions free tier covers this easily. Email service free tier is sufficient for 1 email/day.
- **Privacy:** No game data stored beyond the game ID for deduplication. Email address stored only in GitHub Secrets.
- **Maintainability:** If MLB changes their API structure, the script should fail loudly (clear error messages) rather than silently send broken links.

---

## Out of Scope

- Multi-team support (Mariners only for now)
- Mobile push notifications
- Web UI or dashboard
- Archiving or cataloging past highlights
- Any analysis or commentary on the game

---

## Open Questions

1. **MLB Stats API video availability timing:** How quickly after a game ends do highlight videos appear in the API? This determines whether the 30-min polling window is sufficient or needs to extend later.
2. **Off-season handling:** Should the workflow be manually disabled in the off-season, or just let it run and exit cleanly?
3. **Email service preference:** Resend is recommended for simplicity, but Nick may prefer Gmail SMTP since he already has GCP infrastructure.

---

## Success Criteria

- Email arrives within ~1 hour of game ending on ≥90% of game days
- Email contains a working link to a Mariners highlight video
- Email contains zero spoilers — no scores, no opponent, no outcome language
- Total monthly cost: $0
