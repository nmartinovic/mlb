// Worker-secret verification for post-deploy-check. Issue #166.
//
// Canonical source of truth for which Cloudflare Worker secrets the `mlb`
// Worker is expected to have at runtime. Mirrors the "Configuration: vars vs.
// secrets" table in CLAUDE.md — keep the two in sync. Postmortem #164 landed
// because NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY were never added to the runtime
// store; a deploy-time cross-check against this list would have caught it.

export const REQUIRED_SECRETS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EMAIL_API_KEY",
  "CRON_SECRET",
  "ADMIN_EMAIL",
];

export const OPTIONAL_SECRETS = [
  "EMAILS_PAUSED",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
];

export function verifySecrets(actualNames) {
  const present = new Set(actualNames);
  const known = new Set([...REQUIRED_SECRETS, ...OPTIONAL_SECRETS]);
  const missing = REQUIRED_SECRETS.filter((name) => !present.has(name));
  const extra = actualNames.filter((name) => !known.has(name));
  return { missing, extra };
}

export function parseWranglerSecretList(stdout) {
  const json = JSON.parse(stdout);
  if (!Array.isArray(json)) {
    throw new Error("expected an array from `wrangler secret list --format json`");
  }
  return json.map((entry) => entry.name);
}
