// Client-side "is someone probably signed in?" check, used by the static
// marketing pages (see components/auth-aware-link.js). Those pages are
// prerendered so they cost almost no Worker CPU per request — the Workers Free
// plan allows only 10ms per invocation — which means they can't ask Supabase
// about the session server-side.
//
// @supabase/ssr stores the session in non-httpOnly cookies named
// `sb-<project-ref>-auth-token`, chunked as `.0`, `.1`, … when the value is
// large. The PKCE `sb-<ref>-auth-token-code-verifier` cookie set mid-login is
// deliberately NOT a match. Presence is only a hint: a stale cookie just sends
// the visitor to /dashboard, which re-checks the session and redirects to
// /login if it's gone.
const AUTH_COOKIE_RE = /^sb-[^=]+-auth-token(?:\.\d+)?=./;

export function hasSupabaseAuthCookie(cookieString) {
  if (!cookieString) return false;
  return cookieString
    .split(/;\s*/)
    .some((pair) => AUTH_COOKIE_RE.test(pair));
}
