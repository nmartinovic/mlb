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
