# Mariners Highlights Emailer

A GitHub Actions service that automatically sends a spoiler-free email with a direct link to the Seattle Mariners' daily game highlights video.

No scores. No opponents. No spoilers. Just a link.

## Setup

### 1. Create a Brevo account

Sign up at [brevo.com](https://www.brevo.com) and get an API key from **SMTP & API > API Keys**. The free tier (300 emails/day) is more than enough.

### 2. Configure GitHub Secrets

In your repo, go to **Settings > Secrets and variables > Actions** and add:

| Secret | Description |
|---|---|
| `EMAIL_API_KEY` | Your Brevo API key |
| `RECIPIENT_EMAIL` | Email address to receive highlights |
| `FROM_EMAIL` | Verified sender address (e.g. `highlights@yourdomain.com`) |

### 3. Enable the workflow

The workflow runs automatically on a cron schedule during baseball season (late March through October). It checks every 30 minutes from 6 PM to 1 AM Pacific time.

You can also trigger it manually from the **Actions** tab using the "Run workflow" button.

## How it works

1. Checks the MLB Stats API for today's Mariners game
2. If the game is final, extracts the highlight video URL
3. Sends a spoiler-free email with the video link
4. Records the game ID in `sent-games.json` to avoid duplicates

If highlights aren't available yet, it retries up to 3 times (15-minute intervals). If still unavailable, it sends a fallback email linking to the Mariners video page.

## Local testing

```bash
# Install dependencies
npm install

# Dry run against a past game date (no email sent)
DATE_OVERRIDE=2025-06-15 DRY_RUN=true npm start

# Send a real email for a past game
DATE_OVERRIDE=2025-06-15 \
  EMAIL_API_KEY=xkeysib-xxxxx \
  RECIPIENT_EMAIL=you@example.com \
  FROM_EMAIL=highlights@yourdomain.com \
  npm start
```

## Deduplication

Game IDs are stored in `sent-games.json` and committed to the repo by the workflow. This prevents duplicate emails across cron runs.
