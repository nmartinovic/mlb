import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cookie-free anon client for reading publicly readable (RLS) tables from
// server components — mlb_game_cache on /highlights and /recaps.
//
// Deliberately NOT the cookie-bound client from supabase-server.js: these
// routes sit outside the middleware matcher (middleware.js), so nothing
// refreshes a signed-in visitor's session first. A cookie-bound client would
// refresh an expired token itself but can't write the rotated cookies back from
// a server component, leaving the browser holding a spent refresh token. Public
// reads don't need the visitor's identity at all.
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
