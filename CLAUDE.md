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
  - `admin/` — Owner-only health dashboard (gated by `ADMIN_EMAIL` via `notFound()`); shows total users, emails sent in the last 7 days, and recent cron runs. Also exposes break-glass "Run daily scheduler now" / "Run main cron now" buttons (#110) — see "Break-glass recovery" below
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
| `NEXT_PUBLIC_POSTHOG_KEY` *(optional)* | Browser analytics (`lib/analytics.js`) — missing key disables tracking | PostHog → Project settings → Project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` *(optional)* | PostHog ingest host; defaults to `https://us.i.posthog.com` | PostHog dashboard URL |

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

### If you've forgotten the value (`CRON_SECRET` recovery)

Distinct from planned rotation: this is the path you take mid-incident when you need to manually hit `/api/cron` (or `/api/test-email`) and don't have the current `CRON_SECRET` saved anywhere. **Note:** the `/admin` break-glass buttons (#110) are the preferred recovery path and require no secret at all — only fall back to this runbook when `/admin` itself is unavailable. The 2026-05-02 incident (see `INCIDENT.md`) is the worked example; not having the value saved blocked recovery for ~10 min.

1. **Generate** a new value — any password manager, or `openssl rand -hex 32`. Save it somewhere durable *now*, before pasting it anywhere else.
2. **Replace** in Cloudflare: dashboard → Workers & Pages → `mlb` → Settings → Variables and Secrets → edit `CRON_SECRET` → paste the new value → Save.
3. **No deploy needed.** Cloudflare hot-swaps the secret on the next request to the worker; you do not need to run `npm run deploy` or touch `wrangler` at all.
4. **Use it** from any `ninthinning.email` browser tab via DevTools — no terminal required:
   ```js
   await fetch('/api/cron', { headers: { Authorization: 'Bearer <new value>' } })
     .then(r => r.text());
   ```
5. **Rotate again afterwards** if the new value got pasted anywhere persistent during recovery (chat transcripts, screenshots, an unencrypted note). Treat the recovery value as burnt and re-run steps 1–3 once the incident is closed.

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

## Magic-link email template and auth flow

Branded in #55. The Supabase magic-link email used to ship with Supabase's default template (generic body, no product name, raw `noreply@mail.app.supabase.io` sender via implicit Amazon SES routing). It now matches the cron-recap visual language and resolves a flow mismatch that was breaking sign-in entirely.

Three pieces, two of them dashboard-only:

- **Sender** — covered by #97's custom-SMTP work above. `Ninth Inning Email <highlights@ninthinning.email>` with SPF/DKIM/DMARC passing, no "via" suffix in Gmail.
- **Template** — HTML lives in `supabase/email-templates/magic-link.html` (paste-into-dashboard source of truth, not loaded at runtime). Visually mirrors `lib/email-template.js`: 520px single-column card, 6px ballpark-green accent bar, prominent CTA button using `{{ .ConfirmationURL }}` (Supabase's substitution token — do not change), footer wordmark, and the same non-affiliation disclaimer the cron emails carry. Subject is `Your Ninth Inning Email login link`. Both subject and the first body line name the product so a recipient knows the source without clicking.
- **Auth flow (PKCE, not implicit)** — `/api/login` calls `createClient` from `@/lib/supabase-server` (the `@supabase/ssr` server client) rather than the raw `@supabase/supabase-js` client. The raw client defaults to the implicit OAuth flow, which returns tokens in the URL hash (`#access_token=...`); the SSR client defaults to PKCE, which redirects with `?code=...` query params that our `app/auth/callback/route.js` exchanges for a session via `exchangeCodeForSession`. Mixing them silently breaks sign-in: the verify step succeeds and the user lands on the redirect URL, but the hash never reaches the server callback so no session cookie is set and the user is bounced back to `/login`. This is exactly how #55 first failed in production. Keep `/api/login` on the SSR client.

`emailRedirectTo` prefers `process.env.SITE_URL` and falls back to the request origin, so a misrouted request (e.g. hitting the worker on a `*.workers.dev` URL) can't ship a bad redirect. Note that Supabase only honors `emailRedirectTo` if the URL is on the **Auth → URL Configuration → Redirect URLs** allowlist; an un-allowlisted URL silently falls back to **Site URL**, which is what produced the original "lands on `/login`" symptom in #55. Required allowlist entries: `https://ninthinning.email/auth/callback` and `https://ninthinning.email/dashboard`.

## Cron architecture

Two Cloudflare cron triggers wired in `wrangler.jsonc`, routed to different endpoints by `event.cron` in `scripts/inject-scheduled.mjs` (closes #76):

| Cron | Endpoint | Purpose |
|------|----------|---------|
| `0 13 * * *` (daily, 9am ET in EDT) | `/api/cron/schedule` | Pulls today's MLB slate via `fetchDailySchedule`, upserts one row per game into `mlb_cron_schedule` with `expected_finish_at = first_pitch + 3.5h`, prunes rows older than 36h |
| `*/15 * * * *` (every 15 min) | `/api/cron` | Reads `mlb_cron_schedule`; if no row's `expected_finish_at` is inside the polling window it returns early (no MLB API hits) but still writes a `skipped_no_wake` heartbeat row to `mlb_cron_runs` (#104). Exception (#109): if the table is **entirely empty** during MLB regular season (ET month ∈ [4..10]) the main cron falls through to the full check rather than early-returning, so a dead daily scheduler can't drop a day of emails. Otherwise runs the full check + send fan-out |

The polling window is asymmetric: `expected_finish_at` between `now - 2.5h` and `now + 30m`. Starting 30 min before the predicted finish catches short games; continuing 2.5h after catches extra innings and rain delays. Constants live at the top of `app/api/cron/route.js` (`EARLY_BOUND_MS`, `LATE_BOUND_MS`).

Failure modes worth knowing:

- **Schedule read fails** → main cron falls open (full run) and logs to `console.error`. A transient Supabase blip can't drop emails.
- **Daily scheduler fails** → `mlb_cron_schedule` stays stale. During MLB regular season (#109) the main cron treats an entirely empty table as "scheduler may be down" and falls through to the full check on every `*/15` tick, so emails still go out (~96 extra full-run ticks/day until the scheduler recovers). Outside the season the early-return stays — an empty table is the expected steady state. The failure shows up as a `schedule_failure` row in `mlb_cron_runs` and trips SLO B1 within 26h regardless — watch the admin dashboard.
- **Game runs longer than 6h** (extra innings + rain) → the polling window expires and the every-15-min cron stops checking. The next day's scheduler doesn't re-add yesterday's games, but the existing `getDatesToCheck` helper in `lib/mlb.js` keeps the *full-run* path looking back 2 days, so the **next** valid wake (a different team's game today) will catch the late finisher when it runs the fan-out.
- **DST**: `0 13 * * *` UTC is 9am EDT (most of the MLB regular season) and 8am EST (March/late-October). Both are fine — early-morning is the goal, not exactly 9am.

`mlb_cron_runs` statuses to expect from this stack: `running`, `success`, `partial`, `failure`, `paused`, `no_subscribers`, `no_new_highlights`, `skipped_no_wake` (main cron) and `schedule_running`, `schedule_built`, `schedule_partial`, `schedule_failure` (scheduler). Per postmortem #103 / #104, every `*/15` tick now writes exactly one row — silence is treated as a failure mode, so an empty `mlb_cron_runs` hour means the cron itself isn't running and should page, not "no game in window."

## Break-glass recovery (#110)

When you need to manually kick the cron — e.g. the daily scheduler missed a tick, or a *every-15-min run silently early-returned during a deploy window — the primary recovery path is the **/admin** page, not curl + bearer token.

Two buttons on `/admin`:

- **Run daily scheduler now** — invokes the same code path as `GET /api/cron/schedule` (populates `mlb_cron_schedule` for today).
- **Run main cron now** — invokes the same code path as `GET /api/cron` (checks for completed games and sends emails).

Both run as Next.js Server Actions. Auth is the existing admin session check: the action calls `assertAdmin()` server-side (re-checks `auth.getUser()` and `ADMIN_EMAIL`) before doing any work — `notFound()` on the page hides the buttons but is **not** the security boundary. No `CRON_SECRET` is required, since auth is via the user session, not a bearer token. The shared cron logic lives in `lib/cron-jobs.js` (`runMainCron` and `runScheduler`); both the route handlers and the server actions call into it.

Recovery time goes from ~10 min (rotate `CRON_SECRET`, then DevTools fetch) to ~30 sec (open `/admin`, click button). The 2026-05-02 incident in `INCIDENT.md` is the canonical example of why this matters: not having `CRON_SECRET` saved blocked recovery for the first ~10 min.

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

## Product analytics (#94)

Browser-side event tracking via PostHog. The wrapper in `lib/analytics.js` is a no-op when `NEXT_PUBLIC_POSTHOG_KEY` is unset, so dev/test/preview environments don't ship telemetry. Initialization and user identification happen in `app/posthog-provider.js`, mounted from the root layout — `app/layout.js` calls `supabase.auth.getUser()` so PostHog can `identify()` (or `reset()`) on every render.

Events currently captured:

| Event | Fired from | Notes |
|-------|------------|-------|
| `signup_completed` | `app/dashboard/signup-tracker.js` | The auth callback (`app/auth/callback/route.js`) appends `?signup=1` when `auth.users.created_at` is < 5 min old; the dashboard tracker fires once and strips the param via `router.replace` so a refresh doesn't double-count |
| `team_selected` / `team_deselected` | `app/dashboard/team-grid.js` | Includes `team_id` in props; fired after the Supabase write resolves |
| `unsubscribe_clicked` | `app/unsubscribe/page.js` | Anonymous (no user session), but PostHog distinct_id persists across visits |

Autocapture and session recording are disabled — only the explicit events above. Pageviews and pageleaves are captured automatically by PostHog. To add a new event, import `track` from `@/lib/analytics` and call it from a `"use client"` component.

## Supabase schema conventions

- Every `mlb_*` table has RLS enabled with per-`auth.uid()` policies; the cron worker uses `service_role` (which bypasses RLS) so adding RLS doesn't break the fan-out.
- **Views need explicit grants.** Postgres views run with the owner's privileges, so RLS on the underlying table does **not** apply to the caller. Supabase's defaults grant `SELECT` to `anon` and `authenticated` on any new table or view in `public`. For any view that exposes data from `auth.users` (or any sensitive source), you must explicitly:
  ```sql
  revoke all on public.<view_name> from anon, authenticated, public;
  ```
  See `public.mlb_users` in `supabase-schema.sql` for the canonical example. Skipping this revoke caused an email-enumeration leak that was patched in PR #80.
