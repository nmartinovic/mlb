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

## Configuration: vars vs. secrets

Anything in `wrangler.jsonc` under `vars` is **public** — it ships baked into the worker and can be read by anyone who can run `wrangler deploy --dry-run`. Treat that file as if it were committed to a public repo (it is). Only put non-sensitive config there. Everything else lives as a Cloudflare Worker secret, set with `wrangler secret put`.

### `vars` (public, in `wrangler.jsonc`)

| Name | Purpose |
|------|---------|
| `SITE_URL` | Canonical site URL used for unsubscribe links and `metadataBase` |
| `FROM_EMAIL` | Sender address on transactional email (`highlights@ninthinning.email`) |
| `TIP_URL` | Stripe Payment Link for the tip jar (already a public URL) |

### Secrets (Cloudflare Worker secrets, set via `wrangler secret put <NAME>`)

| Name | Used by | Where it lives upstream |
|------|---------|-------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | server + browser Supabase clients | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | server + browser Supabase clients | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase-admin.js` (cron + unsubscribe only) | Supabase project settings → API → service_role |
| `EMAIL_API_KEY` | `lib/brevo.js` | Brevo dashboard → SMTP & API → API keys |
| `CRON_SECRET` | `/api/cron`, `/api/test-email` (Bearer auth) | Generated locally, e.g. `openssl rand -hex 32` |
| `EMAILS_PAUSED` *(optional)* | Cron kill switch — set to `"true"` to halt sends | Set as a Worker var when needed (see `INCIDENT.md`) |

> The `NEXT_PUBLIC_*` Supabase values are technically not secret (the anon key is shipped to the browser), but they're still stored as Worker secrets so production config lives in one place rather than being split between `vars` and `secret`. RLS is what protects the Supabase data — see `supabase-schema.sql`.

To verify production matches this list:

```bash
npx wrangler secret list   # should match the secrets table above
```

If a secret is missing or extra, fix it before merging — missing-secret regressions have caused outages before (cf. issue #65).

## Secret rotation runbook

Target: any individual secret can be rotated end-to-end in **≤ 30 minutes** with zero email loss. Run through this list dry once per quarter so the steps stay current.

General flow for every secret:

1. **Mint** a new value in the upstream dashboard (links below). Do not revoke the old one yet.
2. **Set** the new value as a Worker secret: `npx wrangler secret put <NAME>` and paste when prompted.
3. **Deploy**: `npm run deploy`. Cloudflare hot-swaps secrets on the next request — no downtime.
4. **Verify** the worker is using the new value (curl an endpoint, watch logs in the Cloudflare dashboard, or wait one cron tick).
5. **Revoke** the old value upstream.
6. **Record** the rotation in `INCIDENT.md` under "Incident log" with the date and reason.

Per-secret specifics:

- **`SUPABASE_SERVICE_ROLE_KEY`** — Supabase dashboard → Project Settings → API → "Reset service_role key". This invalidates the old key immediately, so do step 2 + 3 before clicking reset, then re-issue if needed. Outage window: any cron tick mid-rotation may fail; fine to wait until between hourly ticks.
- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — Same dashboard, "Reset anon key". Browsers holding old sessions will need to re-auth.
- **`EMAIL_API_KEY`** — Brevo → SMTP & API → API keys → "Create a new API key", then delete the old key after step 4.
- **`CRON_SECRET`** — `openssl rand -hex 32` locally → `wrangler secret put CRON_SECRET` → deploy. The cron only calls itself, so there is no third party to update.
- **`TIP_URL`** *(not a secret, but rotated similarly)* — Edit `wrangler.jsonc` and redeploy.

If you suspect a leak rather than a routine rotation, also: review `wrangler tail` for unauthorized requests over the last 24h, set `EMAILS_PAUSED=true` per `INCIDENT.md` if the leaked secret could send mail, and open an incident issue.

## Key Patterns

- Server-side Supabase client uses `supabase-server.js`; admin operations use `supabase-admin.js` (service role key)
- Auth flow uses Supabase magic links with callback at `app/auth/callback/route.js`
- Middleware in `middleware.js` handles session refresh

## Supabase schema conventions

- Every `mlb_*` table has RLS enabled with per-`auth.uid()` policies; the cron worker uses `service_role` (which bypasses RLS) so adding RLS doesn't break the fan-out.
- **Views need explicit grants.** Postgres views run with the owner's privileges, so RLS on the underlying table does **not** apply to the caller. Supabase's defaults grant `SELECT` to `anon` and `authenticated` on any new table or view in `public`. For any view that exposes data from `auth.users` (or any sensitive source), you must explicitly:
  ```sql
  revoke all on public.<view_name> from anon, authenticated, public;
  ```
  See `public.mlb_users` in `supabase-schema.sql` for the canonical example. Skipping this revoke caused an email-enumeration leak that was patched in PR #80.
