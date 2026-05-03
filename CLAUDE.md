# CLAUDE.md

## Project Overview

Ninth Inning Email — spoiler-free MLB game recap videos delivered via email. Next.js app deployed on Cloudflare via OpenNext.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Hosting**: Cloudflare (via @opennextjs/cloudflare)
- **Database & Auth**: Supabase (Postgres + magic link auth)
- **Email**: Brevo transactional API
- **Styling**: Tailwind CSS v4
- **Scheduling**: Cloudflare cron → `/api/cron` (every 15 min, early-returns when no game wake is due) + `/api/cron/schedule` (daily 9am ET, builds the wake list)

## Commands

```bash
npm run dev        # Local dev server
npm run build      # Production build
npm run preview    # Cloudflare local preview
npm run deploy     # Deploy to Cloudflare (then bootstrap + smoke test, see below)
```

### `npm run deploy` post-deploy checks (#108)

After `opennextjs-cloudflare deploy` succeeds, the script chains
`node scripts/post-deploy-check.mjs`, which:

1. Calls `/api/cron/schedule` with `CRON_SECRET` so `mlb_cron_schedule` is
   populated immediately rather than waiting up to ~24h for the next natural
   `0 13 * * *` tick. This closes the first-tick-after-deploy window that
   caused the 2026-05-02 incident (postmortem #103).
2. Verifies both expected cron triggers (`*/15 * * * *` and `0 13 * * *`) are
   registered with Cloudflare via the Workers schedules API. Skipped with a
   warning if `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are not set
   locally; set both to enable strict verification.
3. Asserts that if MLB has games today, at least one row was written for
   today's `game_date`. On offseason days (no MLB slate) this is a no-op.

Required local env: **`CRON_SECRET`** (the production value — keep it in a
gitignored `.env.local` and `source` it before deploying, or export it in your
shell). Without it, deploy exits non-zero before touching the bootstrap call,
so a forgotten secret can't silently skip the check.

Optional local env: **`CLOUDFLARE_API_TOKEN`** + **`CLOUDFLARE_ACCOUNT_ID`**
to enable Cloudflare-side trigger verification.

Any failure exits non-zero so the operator notices on the next prompt.

## Project Structure

- `app/` — Next.js App Router pages and API routes
  - `api/cron/` — Main cron worker (every 15 min). Early-returns when `mlb_cron_schedule` has no expected_finish_at within (now-2.5h, now+30m); otherwise checks for completed games and sends emails. Logs each non-skipped run to `mlb_cron_runs`. See #76.
  - `api/cron/schedule/` — Daily 9am ET scheduler. Pulls today's MLB slate, writes one wake per game (`first_pitch + 3.5h`) into `mlb_cron_schedule`, prunes rows older than 36h.
  - `api/unsubscribe/` — Unsubscribe API
  - `dashboard/` — Team selection UI
  - `admin/` — Owner-only health dashboard (gated by `ADMIN_EMAIL` via `notFound()`); shows total users, emails sent in the last 7 days, and recent cron runs
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
| `ADMIN_EMAIL` | `/admin` page gating (single-user `notFound()` check) | Your Supabase auth email |
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

## Rate limits on the magic-link flow

Audited and hardened in issue #25. The login form POSTs to `/api/login` (`app/api/login/route.js`), which validates the email, applies our own rate limits, and then calls `supabase.auth.signInWithOtp` server-side. The form no longer talks to Supabase directly — that's deliberate, because a browser-direct call bypasses our worker entirely and cannot be rate-limited at the edge.

Two layers of limits apply:

**1. Our worker (`/api/login`)** — Cloudflare Rate Limiting bindings declared in `wrangler.jsonc` under `unsafe.bindings`:

| Binding | Limit | Key |
|---------|-------|-----|
| `LOGIN_IP_LIMITER` | 5 requests / 60s | `cf-connecting-ip` |
| `LOGIN_EMAIL_LIMITER` | 3 requests / 60s | normalized email |

Either bucket's rejection returns HTTP 429 before the request reaches Supabase. (Cloudflare's simple rate limiter only supports `period: 10` or `period: 60` seconds; per-hour buckets would need KV/D1.)

**2. Supabase (Project Settings → Auth → Rate Limits)** — applies to whatever still reaches Supabase:

| Bucket | Limit | Scope |
|--------|-------|-------|
| Sign-ups and sign-ins (`signInWithOtp`) | 30 requests / 5 min | per IP |
| Sending emails (custom SMTP via Brevo) | 30 emails / hour | **project-wide** |

Custom SMTP via Brevo was wired up in #97 to lift the previous built-in-SMTP cap of 2 emails/hour project-wide (which let two throwaway sign-ins per hour DoS the whole project). Magic links now ship from `highlights@ninthinning.email` via `smtp-relay.brevo.com:587`, configured in the Supabase dashboard under Project Settings → Auth → SMTP Settings. The SMTP credential is a Brevo SMTP key (separate from the transactional `EMAIL_API_KEY` the cron uses) and lives only in the Supabase dashboard — it is **not** a Cloudflare Worker secret.

Implications and known gaps:

- The 30 emails/hour Supabase cap is still **project-wide**, just 15× higher than before. Brevo and Supabase share no quota — the ceiling now is whichever of (Supabase's 30/hr, Brevo's daily plan quota) is tighter. Brevo SMTP and the cron's transactional API draw from the same Brevo plan quota, so heavy cron days narrow the magic-link headroom.
- No Cloudflare WAF rate-limit rules are configured on this account; the per-IP/per-email enforcement lives entirely in the worker bindings above. A WAF rule on `POST /api/login` would be a reasonable belt-and-suspenders addition.
- The bindings are no-ops in tests and `next dev` (the worker runtime isn't present); enforcement only kicks in after `npm run deploy`. The route handles missing bindings gracefully and falls through to Supabase, so local dev still works.

## Cron architecture

Two Cloudflare cron triggers wired in `wrangler.jsonc`, routed to different endpoints by `event.cron` in `scripts/inject-scheduled.mjs` (closes #76):

| Cron | Endpoint | Purpose |
|------|----------|---------|
| `0 13 * * *` (daily, 9am ET in EDT) | `/api/cron/schedule` | Pulls today's MLB slate via `fetchDailySchedule`, upserts one row per game into `mlb_cron_schedule` with `expected_finish_at = first_pitch + 3.5h`, prunes rows older than 36h |
| `*/15 * * * *` (every 15 min) | `/api/cron` | Reads `mlb_cron_schedule`; if no row's `expected_finish_at` is inside the polling window it returns early (no MLB API hits) but still writes a `skipped_no_wake` heartbeat row to `mlb_cron_runs` (#104). Otherwise runs the full check + send fan-out |

The polling window is asymmetric: `expected_finish_at` between `now - 2.5h` and `now + 30m`. Starting 30 min before the predicted finish catches short games; continuing 2.5h after catches extra innings and rain delays. Constants live at the top of `app/api/cron/route.js` (`EARLY_BOUND_MS`, `LATE_BOUND_MS`).

Failure modes worth knowing:

- **Schedule read fails** → main cron falls open (full run) and logs to `console.error`. A transient Supabase blip can't drop emails.
- **Daily scheduler fails** → `mlb_cron_schedule` stays stale; the next 24h of every-15-min ticks all early-return ("no wake in window"), and emails for that day's games miss until the next morning's scheduler tick. The failure shows up as a `schedule_failure` row in `mlb_cron_runs` — watch the admin dashboard.
- **Game runs longer than 6h** (extra innings + rain) → the polling window expires and the every-15-min cron stops checking. The next day's scheduler doesn't re-add yesterday's games, but the existing `getDatesToCheck` helper in `lib/mlb.js` keeps the *full-run* path looking back 2 days, so the **next** valid wake (a different team's game today) will catch the late finisher when it runs the fan-out.
- **DST**: `0 13 * * *` UTC is 9am EDT (most of the MLB regular season) and 8am EST (March/late-October). Both are fine — early-morning is the goal, not exactly 9am.

`mlb_cron_runs` statuses to expect from this stack: `running`, `success`, `partial`, `failure`, `paused`, `no_subscribers`, `no_new_highlights`, `skipped_no_wake` (main cron) and `schedule_running`, `schedule_built`, `schedule_partial`, `schedule_failure` (scheduler). Per postmortem #103 / #104, every `*/15` tick now writes exactly one row — silence is treated as a failure mode, so an empty `mlb_cron_runs` hour means the cron itself isn't running and should page, not "no game in window."

## Out-of-band SLO alarms (#107)

The `/admin` banner is passive — it only helps if the operator looks. A pg_cron job inside Supabase runs every 5 minutes and emails `ADMIN_EMAIL` directly when either silent-failure SLO trips:

| SLO | Condition | Catches |
|-----|-----------|---------|
| **B1** (`schedule_stale_26h`) | No `schedule_*` row in `mlb_cron_runs` for 26h | Daily 9am-ET scheduler is dead |
| **B2** (`cron_silent_30m`) | No row in `mlb_cron_runs` for 30m, **April–October ET only** | Cloudflare cron triggers themselves are down |

Emails fire on `not firing → firing` edge transitions only. Recovery is silent (no "all clear" email) so a flapping SLO doesn't spam. State per SLO lives in `public.mlb_alarm_state`.

The pg_cron job calls `public.mlb_check_slo_alarms()`, which uses `pg_net.http_post` to hit the Brevo transactional API directly — no Cloudflare worker involved, so this stays up even if the worker is the thing that's broken. Brevo creds come from Supabase Vault, not from Worker secrets.

### One-time setup

The first time you apply `supabase-schema.sql` against a project, you must:

1. **Enable extensions** in Supabase dashboard → Database → Extensions: turn on `pg_cron` and `pg_net`. The `create extension if not exists` calls in the schema will then succeed; on a project where the SQL-editor role can't `CREATE EXTENSION` directly, the dashboard toggle is the only path.
2. **Set Vault secrets** — Supabase dashboard → Project Settings → Vault → New secret (or run via SQL editor):
   ```sql
   select vault.create_secret('<brevo transactional key>', 'brevo_api_key');
   select vault.create_secret('highlights@ninthinning.email', 'from_email');
   select vault.create_secret('<your admin email>', 'admin_email');
   ```
   Reuse the same Brevo key as `EMAIL_API_KEY` on the Worker. To rotate, run `select vault.update_secret(id, '<new value>')`.

### Verifying it's still active

```sql
-- Job is registered and active
select jobname, schedule, active, command from cron.job where jobname = 'mlb-slo-alarms';

-- Recent runs (succeeded?)
select * from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'mlb-slo-alarms')
 order by start_time desc limit 5;

-- Current SLO state
select * from public.mlb_alarm_state;

-- Recent outbound HTTP calls from pg_net (failures live here, not in raise)
select id, status_code, error_msg, created from net._http_response order by created desc limit 5;
```

### Silencing during planned maintenance

To pause both alarms (e.g. before deliberately stopping the cron for an upgrade):

```sql
select cron.unschedule('mlb-slo-alarms');
```

To resume — re-run the `do $$ ... cron.schedule('mlb-slo-alarms', ...) ... $$` block from `supabase-schema.sql`. Reset stale state if needed:

```sql
update public.mlb_alarm_state set firing = false, last_changed_at = now();
```

For very short pauses (<5 min) the simpler approach is to just expect one alarm email and ignore it — re-arming is automatic on the next non-firing tick.

### Manual test

```sql
-- Force-trip B1: pretend nothing has been written for 26h+ by clearing
-- recent schedule rows in a scratch DB, then run the function manually.
select public.mlb_check_slo_alarms();
-- Inspect: should send one email and flip mlb_alarm_state.firing = true.
-- Calling again should NOT send a second email (edge-only).
```

In production, the natural test is to `cron.unschedule('main')` for the every-15-min cron in Cloudflare for >30 min during the season and confirm B2 fires within 5 min.

## Supabase schema conventions

- Every `mlb_*` table has RLS enabled with per-`auth.uid()` policies; the cron worker uses `service_role` (which bypasses RLS) so adding RLS doesn't break the fan-out.
- **Views need explicit grants.** Postgres views run with the owner's privileges, so RLS on the underlying table does **not** apply to the caller. Supabase's defaults grant `SELECT` to `anon` and `authenticated` on any new table or view in `public`. For any view that exposes data from `auth.users` (or any sensitive source), you must explicitly:
  ```sql
  revoke all on public.<view_name> from anon, authenticated, public;
  ```
  See `public.mlb_users` in `supabase-schema.sql` for the canonical example. Skipping this revoke caused an email-enumeration leak that was patched in PR #80.
