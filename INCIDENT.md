# Takedown & Incident Response

## Abuse / takedown inbox

`abuse@ninthinning.email` — monitored daily.

All DMCA notices, MLB rights inquiries, and takedown requests go here. Set up this address as a forwarding alias in your domain's email settings before launch.

## Break-glass: manually kick the cron

Primary path (per #110): open `/admin` while signed in as `ADMIN_EMAIL` and click **Run daily scheduler now** or **Run main cron now**. Both run server-side under the existing admin session check — no `CRON_SECRET` needed. The response renders inline so you can confirm what happened (e.g. *"Scheduled 15 wakes for 2026-05-02"* or *"Processed 1 games, sent 1 emails"*).

This replaces the old recovery procedure (rotate `CRON_SECRET` → DevTools fetch with bearer header), which on 2026-05-02 wasted ~10 min at the start of an incident because the secret wasn't saved anywhere. If `/admin` itself is broken (e.g. Supabase auth is down), fall back to bearer-token curl against `/api/cron/schedule` and `/api/cron`.

## Kill switch

To pause all outbound email sends immediately — no code deploy needed:

1. Go to [Cloudflare dashboard](https://dash.cloudflare.com) → Workers & Pages → **mlb** → Settings → Variables.
2. Add (or update) the variable `EMAILS_PAUSED` = `true`.
3. Save. The next cron invocation will exit early without sending any emails.

To resume, delete the variable or set it to anything other than `"true"`.

## Response plan

| Step | Action | SLA |
|------|--------|-----|
| 1 | Receive notice at `abuse@ninthinning.email` | — |
| 2 | Acknowledge receipt to sender | within 24 hours |
| 3 | Activate kill switch (set `EMAILS_PAUSED=true`) | within 2 hours of a valid DMCA/C&D |
| 4 | Assess validity of the claim | within 48 hours |
| 5 | If valid: remove or modify the infringing content, notify sender | within 48 hours of step 3 |
| 6 | If invalid: draft a counter-notice; consult counsel before sending | — |
| 7 | Re-enable sends (remove `EMAILS_PAUSED`) after resolution | after step 5 or 6 |
| 8 | Document the incident in this file under "Incident log" | within 7 days |

## What counts as a valid notice

- Identifies the copyrighted work claimed to be infringed.
- Identifies the infringing material with enough detail to locate it.
- Includes contact information and a good-faith statement.
- Signed (electronic signature is fine).

MLB DMCA agent contact: https://www.mlb.com/official-information/terms-of-use

## Incident log

- 2026-04-30 — Routine `CRON_SECRET` rotation dry-run (per #56 acceptance criteria). No incident.
- 2026-05-02 — Missed Mariners recap email (game_pk 823144). `mlb_cron_schedule` was empty because the daily 9am-ET scheduler had never run: the `0 13 * * *` trigger added in #76 only registered with Cloudflare on the deploy that landed ~04:00 UTC today, and the every-15-min cron silently early-returned for ~5h until manual intervention. Recovered by curling `/api/cron/schedule` to populate today's slate, then inserting a synthetic wake-in-window for 823144 and triggering `/api/cron`. `CRON_SECRET` rotated twice during recovery (forgotten value → temporary value → fresh value, since the temporary was pasted in a chat transcript). Followups: alarm on missing `schedule_built` row in any 26h window so this doesn't go undetected again; verify the next 13:00 UTC scheduler tick fires automatically.
- 2026-05-04 — Disclosure decision for the `mlb_users` view email-enumeration exposure patched in PR #80 (issue #82). **No notification sent, no public note posted.** Rationale: the only signed-up user during the affected window was the project owner, so there is no third party to disclose to. Decision recorded here for posterity per the issue's acceptance criteria; closing #82 with no further action.
- 2026-05-17 — Cron tick threw `supabaseUrl is required` on every `*/15` invocation; `mlb_cron_runs` went silent and SLO B1 fired because the daily 9am-ET scheduler couldn't reach `startRun()` either. Root cause was a config split-brain, not a code bug. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were set only in the Cloudflare **Build → Variables and secrets** section, so Next.js's webpack `DefinePlugin` inlined them into the HTTP-route bundles (HTTP traffic stayed healthy and masked the outage). The cron shim is bundled separately by esbuild (`scripts/inject-scheduled.mjs`) with no `NEXT_PUBLIC_*` inlining, and after #163 the injected `scheduled()` handler reads those values off the Worker `env` bindings — which only contain what lives in **Settings → Variables and Secrets** at runtime. Both keys were missing there, so `env.NEXT_PUBLIC_SUPABASE_URL` was `undefined`, `createAdminClient` threw, the error was caught by our try/catch, and Cloudflare counted the invocation as `outcome: "ok"` despite the failure. Recovered by adding both keys as Worker runtime secrets in the dashboard (no deploy required — Cloudflare hot-swaps on the next tick). #163's fix (passing `env` explicitly to bundled cron functions) was a prerequisite for this to work; before #163 the values would have been ignored even if present. Followups: (1) consider failing fast at worker startup if the cron shim's required env bindings are missing, so the next regression surfaces as a deploy-time error instead of a silent SLO trip; (2) add a `npx wrangler secret list` cross-check to the post-deploy script alongside the existing trigger-presence check (CLAUDE.md already documents the expected list); (3) revisit whether `NEXT_PUBLIC_*` values should be sourced from one place (build OR runtime) with the other derived, rather than duplicated by hand — duplication is what hid this for one full deploy cycle.
