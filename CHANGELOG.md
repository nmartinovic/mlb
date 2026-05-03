# Changelog

All notable changes to Ninth Inning Email are documented here.

## [Unreleased]

### Added
- Post-deploy bootstrap + smoke test for the cron stack (closes #108, PR #115). Cloudflare cron triggers fire on schedule, not on registration: a deploy that lands after 13:00 UTC leaves `mlb_cron_schedule` unpopulated until the next natural `0 13 * * *` tick, during which every `*/15` main-cron tick early-returns and game-day emails miss silently. This was the proximate cause of the 2026-05-02 incident (postmortem #103, action C1+C2). `npm run deploy` now chains a new `node scripts/post-deploy-check.mjs` step after `opennextjs-cloudflare deploy` that (1) calls `/api/cron/schedule` with `CRON_SECRET` so the schedule table is populated immediately rather than after a delay of up to ~24h, (2) verifies both expected cron triggers (`*/15 * * * *` and `0 13 * * *`) are registered with Cloudflare via the Workers schedules API when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set locally (warns and continues otherwise), and (3) asserts today's row presence with a direct MLB Stats API probe so an empty schedule on a game day fails the deploy instead of being misread as offseason. Missing `CRON_SECRET` exits non-zero before any network call so a forgotten secret can't silently skip the bootstrap. New "`npm run deploy` post-deploy checks" subsection in `CLAUDE.md` documents the required/optional env and the exact assertions
- Out-of-band SLO alarms for the cron stack (closes #107, PR #113). The `/admin` scheduler-health banner from PR #112 is passive — it only helps if the operator looks. Added a pg_cron job inside Supabase that runs every 5 minutes and calls `public.mlb_check_slo_alarms()`, which evaluates two silent-failure SLOs against `mlb_cron_runs`: **B1** (no row with status starting `schedule_` in the last 26h, catches a dead daily 9am-ET scheduler — the failure mode from postmortem #103) and **B2** (no row at all in the last 30m, gated to April–October ET, catches Cloudflare cron triggers themselves being down). Emails fire to `ADMIN_EMAIL` via `pg_net.http_post` directly to the Brevo transactional API — no Cloudflare worker involved, so the watcher stays up if the worker is the thing that's broken. Per-SLO state lives in the new `public.mlb_alarm_state` table; emails fire on `not firing → firing` transitions only, so a stuck alarm doesn't spam every 5 minutes and recovery is silent. One-time setup requires enabling `pg_cron` and `pg_net` extensions in the Supabase dashboard and creating three Vault secrets (`brevo_api_key`, `from_email`, `admin_email`); operator runbook covering setup, verification queries, silencing during planned maintenance (`cron.unschedule('mlb-slo-alarms')`), and a manual test recipe lives in the new "Out-of-band SLO alarms" section of `CLAUDE.md`. Self-tested in production via a manual `_mlb_send_alarm_email()` call returning HTTP 201 from Brevo

### Changed
- Cron scheduling is now game-aware (closes #76, PR #100). The previous fixed hourly schedule (`0 * * * *`) wasted runs in the offseason and overnight, and let games sit up to an hour between fixed ticks before email delivery. Replaced with two Cloudflare cron triggers routed by `event.cron` in `scripts/inject-scheduled.mjs`: a daily 9am ET scheduler (`0 13 * * *` → `/api/cron/schedule`) that pulls today's MLB slate via the new `fetchDailySchedule` helper and writes one row per game (`expected_finish_at = first_pitch + 3.5h`) into a new `mlb_cron_schedule` table, plus a `*/15 * * * *` main cron (`/api/cron`) that reads the schedule and **early-returns** when no row's `expected_finish_at` falls inside an asymmetric polling window (`now − 2.5h` to `now + 30m`). Offseason and overnight ticks now exit without hitting MLB Stats API or any Supabase write path. The 2.5h tail catches extra innings / rain delays; the 30m head catches short games. The early-return path intentionally writes **no** `mlb_cron_runs` row to satisfy the #76 acceptance criterion ("exits within 50ms without hitting Supabase write paths"). Schedule-read errors fall open to a full run so a transient Supabase blip can't drop emails. Cron architecture documented in a new "Cron architecture" section of `CLAUDE.md`
- Supabase Auth magic links now send through Brevo SMTP instead of Supabase's built-in mailer (closes #97). The built-in service is capped at **2 emails/hour project-wide** with no per-user/per-IP scope, which meant two throwaway sign-ins per hour could DoS legitimate users across the entire project — and rate limiting at the worker edge couldn't fix it because the cap is structural to Supabase. Custom SMTP is configured in the Supabase dashboard (Project Settings → Auth → SMTP Settings) pointing at `smtp-relay.brevo.com:587` with a Brevo SMTP key (separate credential from the transactional `EMAIL_API_KEY` the cron already uses; lives only in the Supabase dashboard, not as a Worker secret). Magic links now arrive from `Ninth Inning Email <highlights@ninthinning.email>` matching the cron transactional sender. The Supabase "Rate limit for sending emails" lifted from 2/hour to **30/hour project-wide** as a result; the worker-side `LOGIN_IP_LIMITER` (5/60s per IP) and `LOGIN_EMAIL_LIMITER` (3/60s per email) from PR #96 stay in place and now serve double duty as protection against burning the new (larger but still finite) custom-SMTP quota. Updated the "Rate limits on the magic-link flow" section of `CLAUDE.md` with the new cap and dropped the "tracked separately from #25" caveat

### Security
- Hardened rate limiting on the magic-link sign-in flow (closes #25). The login form previously called `supabase.auth.signInWithOtp` directly from the browser, so requests bypassed our Cloudflare worker entirely and the only rate limit was Supabase's defaults (30 req/5min per IP for sign-ins, 2 emails/hr project-wide on built-in SMTP). The form now POSTs to a new `/api/login` route which applies two `unsafe.bindings` rate limiters before calling Supabase server-side: `LOGIN_IP_LIMITER` (5 requests/60s per `cf-connecting-ip`) and `LOGIN_EMAIL_LIMITER` (3 requests/60s per normalized email). Either rejection returns 429. Audit findings and the new layer are documented in the "Rate limits on the magic-link flow" section of `CLAUDE.md` so future sessions don't re-investigate

### Added
- `mlb_cron_schedule` Supabase table — one row per game in today's slate with `game_pk` (PK), `expected_finish_at`, `game_date`, `created_at`. RLS-enabled-no-policies (service-role only), index on `expected_finish_at` to keep the every-15-min schedule read cheap (PR #100, closes #76)
- `/api/cron/schedule` endpoint backing the daily 9am ET cron, with `mlb_cron_runs` statuses `schedule_running` / `schedule_built` / `schedule_partial` / `schedule_failure` so the admin dashboard can surface scheduler health (PR #100)
- `lib/mlb.js` helpers `fetchDailySchedule`, `extractScheduledGames`, `computeExpectedFinish`, `getEtTodayDate`, plus an `EXPECTED_GAME_DURATION_HOURS` constant (3.5h) used by both the scheduler and the docs (PR #100)
- 18 new tests across `lib/mlb.test.js`, `app/api/cron/route.test.js` (new), `app/api/cron/schedule/route.test.js` (new), and `wrangler.test.js`. Locks in the early-return contract (no MLB API call, no `mlb_cron_runs` row written), the asymmetric window bounds, the schedule-read fail-open, the EMAILS_PAUSED short-circuit ordering, and both cron triggers in `wrangler.jsonc` (PR #100)
- `app/api/login/route.test.js` covering input validation, both 429 paths, email normalization, Supabase error pass-through, and the no-binding fallback used in local dev
- `wrangler.test.js` assertion locking in the `LOGIN_IP_LIMITER` and `LOGIN_EMAIL_LIMITER` bindings so a future config edit can't silently disable the rate limit

## [2026-05-01]

### Added
- `mlb_cron_runs` Supabase table — one row per authorized `/api/cron` invocation, capturing `started_at`, `finished_at`, `status` (`success` / `partial` / `failure` / `paused` / `no_subscribers` / `no_new_highlights` / `running`), `games_processed`, `emails_sent`, `errors_count`, and a jsonb `errors` array. Service-role-only via RLS-enabled-no-policies, matching the `mlb_users` view pattern (PR #87, closes #86)
- Owner-only `/admin` dashboard at `app/admin/page.js` — gated by `ADMIN_EMAIL` Worker secret via `notFound()` so non-owners can't tell the route exists. Shows total users, emails sent in the last 7 days, last cron status with relative timestamp, a 10-run history table, and an errors panel for the latest run (PR #87, closes #86)
- `ADMIN_EMAIL` Cloudflare Worker secret added to the `CLAUDE.md` secrets table and `.env.local.example`

### Changed
- `/api/cron` now wraps its body in a top-level try/catch and finalizes the `mlb_cron_runs` row on every exit path. Inner-loop errors that previously only hit `console.error` are now persisted to the `errors` jsonb column

### Project management
- Split #68 (umbrella "engagement + cron-health instrumentation") into three focused issues: #84 (product analytics), #85 (email engagement), #86 (cron health). Closed #68 as superseded

## [2026-04-30]

### Security
- Fixed email-enumeration leak via the `public.mlb_users` view: Postgres views run with the owner's privileges by default, so RLS on `auth.users` did not apply when `anon`/`authenticated` read the view, and any visitor with the (browser-shipped) anon key could list every signed-up user's id and email. Patched in production by `revoke all on public.mlb_users from anon, authenticated, public;`, and now baked into `supabase-schema.sql` so any new project bootstrapped from it isn't vulnerable. Service-role access (which the cron worker uses) is unaffected. Surfaced during the #56 audit (PR #80)
- One-time secrets-exposure audit: gitleaks across all 62 commits and manual greps for `SUPABASE_SERVICE_ROLE`, `EMAIL_API_KEY`, `xkeysib-`, `CRON_SECRET`, and Stripe key prefixes confirmed no secrets have ever been committed; `wrangler.jsonc` `vars` only contain non-sensitive values (`SITE_URL`, `FROM_EMAIL`, `TIP_URL`); `supabase-admin.js` is only imported from server-side API routes; client components reference only `NEXT_PUBLIC_*` env vars; RLS is enabled on every `mlb_*` table (PR #79, closes #56)

### Added
- `secret-scan` job in `.github/workflows/test.yml` running gitleaks on every PR and push to `main`, with `fetch-depth: 0` so the full history is scanned (PR #79, closes #56)
- "Configuration: vars vs. secrets" section in `CLAUDE.md` with the canonical secret list and per-secret rotation runbook targeting a 30-minute end-to-end rotation; rotation dry-run completed against `CRON_SECRET` and recorded in `INCIDENT.md` (PR #79, closes #56)
- "Supabase schema conventions" note in `CLAUDE.md` capturing the `mlb_users`-view lesson: any view selecting from `auth.users` must explicitly revoke from `anon`/`authenticated`, since views inherit the owner's privileges and bypass RLS

### Changed
- Tightened `.gitignore` to block `.env`, `.env.*`, `.dev.vars*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, while keeping `.env.local.example` tracked (PR #79, closes #56)
- Brevo `sender` now includes a friendly display name ("Ninth Inning Email") in `app/api/cron/route.js` and `app/api/test-email/route.js`, so inboxes show the brand instead of the raw `highlights@ninthinning.email` address (closes #19)
- Extracted the Brevo transactional call into `lib/brevo.js` (`sendEmail` + `SENDER_NAME`); cron and test-email routes now share one implementation, and the helper accepts an injectable `fetchImpl` so it can be unit-tested without hitting Brevo

### Added
- `lib/brevo.test.js` covering request shape (endpoint, headers, body), `sender.name`, `sender.email`, recipient/subject/html forwarding, and the non-2xx error path — locks in the sender display name as a regression test

## [2026-04-28]

### Added
- Vitest test harness with `npm test` and `npm run test:watch` scripts (PR #63, closes #61)
- 34 unit tests covering the highest-risk modules: `lib/mlb.js` (schedule/content fetch, highlight extraction across legacy + EPG fallbacks, date helpers), `lib/teams.js` (shape and uniqueness of all 30 teams), `lib/email-template.js` (team rendering, `SITE_URL`/`NEXT_PUBLIC_SITE_URL` fall-through, `TIP_URL` toggle), and `app/api/unsubscribe/route.js` (token validation + supabase error path)
- SessionStart hook (`.claude/hooks/session-start.sh`) that runs `npm install && npm test` on remote Claude Code sessions so each one starts on a green baseline
- GitHub Actions workflow (`.github/workflows/test.yml`) running `npm ci && npm test` on every push to `main` and every PR

### Changed
- Extracted `buildEmailHtml` from `app/api/cron/route.js` into `lib/email-template.js` so it can be tested without mocking Supabase or Brevo
- Restored `TIP_URL` to `wrangler.jsonc` as a plain `vars` entry; managing it as an out-of-band Cloudflare Worker secret left it undefined in production after deploys, reverting the approach taken in PR #57 (PR #66)

### Fixed
- "Tip the developer" row missing from cron recap emails and the landing page FAQ; `process.env.TIP_URL` was undefined in the deployed worker, so the conditional in `lib/email-template.js` and `app/page.js` silently dropped the block (PR #66, closes #65)

### Added
- `wrangler.test.js` regression test asserting `TIP_URL` is defined in `wrangler.jsonc` so CI catches a re-removal (PR #66)

## [2026-04-27]

### Added
- Marketing-quality landing page: hero with inline email preview, stat strip, "How it works" 3-step grid, sample email section, FAQ via `<details>`, final CTA, and footer (PR #58, closes #16)
- Open Graph / Twitter share image at `/opengraph-image` generated via `next/og` `ImageResponse` (PR #58)
- Layout metadata extended with `metadataBase`, `openGraph`, `twitter`, `keywords`, and canonical alternate (PR #58)
- Promoted tip link in cron emails to its own centered row above the footer ("Enjoying Ninth Inning Email? Tip the developer to keep it running.") (PR #60)

### Changed
- Renamed app from "Highlight Reel" to "Ninth Inning Email" across landing page, layout metadata, OG image, both email templates, README, CLAUDE.md, CHANGELOG, and `public/architecture.html` (PR #60)
- Replaced tech-blue palette with ballpark theme: field-green (`#0f5132`) surfaces, cream (`#f5f1e6`) text, stitching-red (`#c41e3a`) CTAs, near-black green-tinted (`#0a1410`) background (PR #60)
- Swapped "How it works" steps 2 and 3; order is now pick teams → check inbox → watch (or don't), copy rebalanced for the new flow (PR #60)

## [2026-04-26]

### Added
- Tip jar via Stripe Payment Link, configurable through the `TIP_URL` Cloudflare Worker secret (PR #57, closes #51)
- Kill switch documented in `INCIDENT.md`: setting `EMAILS_PAUSED=true` in the Cloudflare dashboard pauses all outbound email sends without a redeploy (PR #57)
- Abuse inbox and DMCA / takedown response plan in `INCIDENT.md` (`abuse@ninthinning.email`) (PR #57)

### Changed
- Tip jar provider switched from Buy Me a Coffee to Stripe Payment Link (PR #57)
- `TIP_URL` removed from `wrangler.jsonc` and stored as a Cloudflare Worker secret instead of a plain var (PR #57)

## [2026-04-22]

### Added
- Custom domain `ninthinning.email` connected to Cloudflare Worker (PR #54, closes #53)
- `routes` entry in `wrangler.jsonc` to declare custom domain in Worker config

### Changed
- `SITE_URL` updated from `mlb.nmartinovic.workers.dev` to `https://ninthinning.email`
- `FROM_EMAIL` updated to `highlights@ninthinning.email`
- Supabase Site URL and auth redirect URLs updated to `ninthinning.email`
- Brevo sender domain authenticated for `ninthinning.email`; SPF, DKIM, DMARC records configured
