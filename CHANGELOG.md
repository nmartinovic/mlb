# Changelog

All notable changes to Highlight Reel are documented here.

## [Unreleased]

## [2026-04-22]

### Added
- Custom domain `ninthinning.email` connected to Cloudflare Worker (PR #54, closes #53)
- `routes` entry in `wrangler.jsonc` to declare custom domain in Worker config

### Changed
- `SITE_URL` updated from `mlb.nmartinovic.workers.dev` to `https://ninthinning.email`
- `FROM_EMAIL` updated to `highlights@ninthinning.email`
- Supabase Site URL and auth redirect URLs updated to `ninthinning.email`
- Brevo sender domain authenticated for `ninthinning.email`; SPF, DKIM, DMARC records configured
