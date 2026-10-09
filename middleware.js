import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Real 307 for signed-out dashboard visits. The page's own redirect("/login")
  // still backstops this, but it arrives as a streamed meta-refresh once the
  // (now synchronous) root layout has flushed.
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

// Only routes that read the session server-side. Middleware runs inside the
// same Worker invocation as the page, so matching every path (as it once did)
// spent CPU on each marketing-page and crawler hit — the Workers Free plan
// allows 10ms per invocation. Public pages that read Supabase use the
// cookie-free client in lib/supabase-public.js, so they need no refresh here.
// Add a path when a new server component or route calls getUser().
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/api/account",
    "/api/welcome",
    "/api/auth/:path*",
  ],
};
