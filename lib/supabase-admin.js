import { createClient } from "@supabase/supabase-js";

// Service-role client for server-side operations (cron worker, etc.)
// This bypasses Row Level Security — use only in trusted server contexts.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
