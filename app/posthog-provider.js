"use client";

import { useEffect } from "react";
import { initAnalytics, identify, resetAnalytics } from "@/lib/analytics";
import { hasSupabaseAuthCookie } from "@/lib/auth-cookie";

// Identifies the signed-in user client-side. The root layout used to pass the
// user down from a server-side getUser(), but that forced every page to render
// dynamically (see app/layout.js). The Supabase browser client is only loaded
// when a session cookie is present, so anonymous visitors don't download it.
export default function PostHogProvider() {
  useEffect(() => {
    initAnalytics();
    if (!hasSupabaseAuthCookie(document.cookie)) {
      resetAnalytics();
      return;
    }

    let cancelled = false;
    import("@/lib/supabase-browser")
      .then(({ createClient }) => createClient().auth.getUser())
      .then(({ data: { user } }) => {
        if (cancelled) return;
        if (user) {
          identify(user.id, user.email ? { email: user.email } : undefined);
        } else {
          resetAnalytics();
        }
      })
      .catch(() => {
        // Analytics is best-effort; never surface an auth hiccup here.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
