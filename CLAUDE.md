# CLAUDE.md

## Project Overview

Highlight Reel — spoiler-free MLB game recap videos delivered via email. Next.js app deployed on Cloudflare via OpenNext.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Hosting**: Cloudflare (via @opennextjs/cloudflare)
- **Database & Auth**: Supabase (Postgres + magic link auth)
- **Email**: Brevo transactional API
- **Styling**: Tailwind CSS v4
- **Scheduling**: Cloudflare cron → `/api/cron` route

## Commands

```bash
npm run dev        # Local dev server
npm run build      # Production build
npm run preview    # Cloudflare local preview
npm run deploy     # Deploy to Cloudflare
```

## Project Structure

- `app/` — Next.js App Router pages and API routes
  - `api/cron/` — Cron worker that checks for completed games and sends emails
  - `api/unsubscribe/` — Unsubscribe API
  - `api/test-email/` — Manual email test endpoint (requires CRON_SECRET)
  - `dashboard/` — Team selection UI
  - `login/` — Magic link auth
  - `auth/callback/` — Supabase OAuth callback (handles auth errors → redirects to /login?error=auth)
  - `unsubscribe/` — Unsubscribe confirmation page
- `lib/` — Shared utilities
  - `mlb.js` — MLB Stats API client
  - `teams.js` — 30 MLB teams data
  - `supabase-*.js` — Supabase client helpers (server, browser, admin)
  - `unsubscribe-token.js` — HMAC-SHA256 signed token helpers for unsubscribe links

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY       # Supabase service role (admin operations)
EMAIL_API_KEY                   # Brevo API key
CRON_SECRET                     # Bearer token to authorize cron calls
NEXT_PUBLIC_SITE_URL            # Full site URL, used in unsubscribe links
FROM_EMAIL                      # Sender address for outbound emails
UNSUBSCRIBE_SECRET              # Secret for HMAC-signing unsubscribe tokens
                                # (falls back to CRON_SECRET if not set)
```

## Key Patterns

- Server-side Supabase client uses `supabase-server.js`; admin operations use `supabase-admin.js` (service role key)
- Auth flow uses Supabase magic links with callback at `app/auth/callback/route.js`
  - Error from `exchangeCodeForSession` redirects to `/login?error=auth` (not silently to dashboard)
- Middleware in `middleware.js` handles session refresh
- Unsubscribe links in emails use HMAC-signed tokens (`lib/unsubscribe-token.js`), not raw user IDs
  - Token format: `{userId}.{hex-hmac-sha256}`
  - `signToken(userId)` / `verifyToken(token)` use `UNSUBSCRIBE_SECRET` (or `CRON_SECRET`)
- Email delivery in `api/cron/route.js` uses `sendEmailWithRetry` (3 attempts, 1s/2s backoff) — not fire-and-forget
- Dashboard team toggles (`app/dashboard/team-grid.js`) revert optimistic UI and show an error message on DB failure

## Security Notes

- `/api/test-email` is gated behind `CRON_SECRET` and validates the `?to=` email format
- `/api/unsubscribe` verifies the HMAC token before touching the DB — raw user IDs are rejected
- RLS policies on all Supabase tables; only service role key bypasses them (admin routes only)
