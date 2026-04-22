# Highlight Reel

Spoiler-free MLB game recap videos, delivered to your inbox. No scores, no spoilers — just the highlights.

## Architecture

- **Framework**: Next.js 15 (App Router)
- **Hosting**: Cloudflare (via @opennextjs/cloudflare)
- **Database & Auth**: Supabase (Postgres + magic link auth)
- **Email**: Brevo transactional API
- **Styling**: Tailwind CSS v4
- **Scheduling**: Cloudflare cron → `/api/cron` route

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
FROM_EMAIL=highlights@ninthinning.email
CRON_SECRET=generate-a-random-string
NEXT_PUBLIC_SITE_URL=https://ninthinning.email
```

For Cloudflare deployment, set secrets via Wrangler:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put EMAIL_API_KEY
npx wrangler secret put CRON_SECRET
```

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Cloudflare

```bash
npm run deploy
```

The cron schedule is defined in `wrangler.jsonc`. To preview locally with the Cloudflare runtime:

```bash
npm run preview
```

## Project structure

```
app/
  layout.js                  # Root layout
  page.js                    # Landing page
  login/page.js              # Magic link auth
  dashboard/page.js          # Team selection
  dashboard/team-grid.js     # Team grid component
  unsubscribe/page.js        # One-click unsubscribe
  auth/callback/route.js     # Auth callback
  api/cron/route.js          # Cron worker (multi-team)
  api/unsubscribe/route.js   # Unsubscribe API
  api/auth/signout/route.js  # Sign out
  api/test-email/route.js    # Email testing
lib/
  mlb.js                     # MLB Stats API client
  teams.js                   # 30 MLB teams data
  supabase-server.js         # Server-side Supabase client
  supabase-browser.js        # Browser-side Supabase client
  supabase-admin.js          # Admin client (service role)
middleware.js                # Session refresh middleware
wrangler.jsonc               # Cloudflare Workers config
supabase-schema.sql          # Database schema
```
