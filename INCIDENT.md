# Takedown & Incident Response

## Abuse / takedown inbox

`abuse@ninthinning.email` — monitored daily.

All DMCA notices, MLB rights inquiries, and takedown requests go here. Set up this address as a forwarding alias in your domain's email settings before launch.

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

_No incidents recorded._
