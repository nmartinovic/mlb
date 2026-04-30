# Changelog

All notable changes to Ninth Inning Email are documented here.

## [Unreleased]

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
