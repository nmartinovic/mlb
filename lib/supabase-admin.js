import { createClient } from "@supabase/supabase-js";

// Service-role client for server-side operations (cron worker, etc.)
// This bypasses Row Level Security — use only in trusted server contexts.
//
// Accepts explicit url/key args so the Cloudflare scheduled() handler can pass
// Worker bindings directly (its process.env bridge doesn't reach this bundled
// module — see #163). HTTP callers leave the args undefined and pick up
// process.env via OpenNext's fetch wrapper, which is the path that works.
export function createAdminClient(supabaseUrl, serviceRoleKey) {
  return createClient(
    supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// Service-role client for the STAGING Supabase project (#180). The automated
// dry-run (lib/cron-jobs.staging.test.js) uses this so its mlb_game_cache and
// mlb_cron_runs writes land in an isolated project, never production.
//
// Returns null when SUPABASE_STAGING_URL / SUPABASE_STAGING_SERVICE_ROLE_KEY
// are unset, so callers can skip cleanly rather than crash — staging is opt-in
// infrastructure and these values are never present in production.
export function createStagingClient() {
  const url = process.env.SUPABASE_STAGING_URL;
  const key = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
