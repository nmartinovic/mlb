# CLAUDE.md

## Project Overview

Ninth Inning Email — spoiler-free MLB game recap videos delivered via email. Next.js app deployed on Cloudflare via OpenNext.

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
  - `dashboard/` — Team selection UI
  - `login/` — Magic link auth
- `lib/` — Shared utilities
  - `mlb.js` — MLB Stats API client
  - `teams.js` — 30 MLB teams data
  - `supabase-*.js` — Supabase client helpers (server, browser, admin)
- `supabase-schema.sql` — Database schema

## Production

- **URL**: https://ninthinning.email
- **Cloudflare Worker**: `mlb` (custom domain declared in `wrangler.jsonc` under `routes`)
- **Email sender**: `Ninth Inning Email <highlights@ninthinning.email>` (Brevo, domain authenticated; display name set in `app/api/cron/route.js` and `app/api/test-email/route.js`)
- **Supabase auth redirect**: `https://ninthinning.email/auth/callback`
- `SITE_URL` and `FROM_EMAIL` are set as vars in `wrangler.jsonc`; secrets (Supabase keys, `EMAIL_API_KEY`, `CRON_SECRET`) are stored as Cloudflare Worker secrets via Wrangler

## Key Patterns

- Server-side Supabase client uses `supabase-server.js`; admin operations use `supabase-admin.js` (service role key)
- Auth flow uses Supabase magic links with callback at `app/auth/callback/route.js`
- Middleware in `middleware.js` handles session refresh
