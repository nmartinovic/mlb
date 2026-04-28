# Changelog

All notable changes to Ninth Inning Email are documented here.

## [Unreleased]

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
