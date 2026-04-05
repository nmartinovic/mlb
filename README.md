# Highlight Reel

Spoiler-free MLB game recap videos, delivered to your inbox. No scores, no spoilers — just the highlights.

## Architecture

- **Frontend**: Next.js (App Router) on Vercel
- **Database & Auth**: Supabase (Postgres + magic link auth)
- **Email**: Brevo transactional API
- **Scheduling**: Vercel Cron → `/api/cron` route

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase-schema.sql` in the SQL editor
3. Enable email auth (magic links) in Authentication → Providers
4. Copy the project URL, anon key, and service role key

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
EMAIL_API_KEY=xkeysib-xxxxx
FROM_EMAIL=highlights@yourdomain.com
CRON_SECRET=generate-a-random-string
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

Connect the repo to Vercel. Add the environment variables in the Vercel dashboard. The cron schedule is defined in `vercel.json`.

## Project structure

```
app/
  page.js                    # Landing page
  login/page.js              # Magic link auth
  dashboard/page.js          # Team selection
  unsubscribe/page.js        # One-click unsubscribe
  auth/callback/route.js     # OAuth callback
  api/cron/route.js          # Cron worker (multi-team)
  api/unsubscribe/route.js   # Unsubscribe API
  api/auth/signout/route.js  # Sign out
lib/
  mlb.js                     # MLB Stats API utilities
  teams.js                   # 30 MLB teams data
  supabase-server.js         # Server-side Supabase client
  supabase-browser.js        # Browser-side Supabase client
  supabase-admin.js          # Admin client (service role)
```
