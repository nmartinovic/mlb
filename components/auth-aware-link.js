"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasSupabaseAuthCookie } from "@/lib/auth-cookie";

// A link that differs for signed-in visitors ("Dashboard" vs "Sign in"), for
// use on prerendered marketing pages. The static HTML always carries the
// signed-out variant; after hydration it swaps to the signed-in variant when a
// Supabase session cookie is present. Checking the session server-side would
// force a full React render on every request, which blows the Workers Free
// plan's 10ms CPU budget (see "Worker CPU budget" in CLAUDE.md).
export default function AuthAwareLink({ signedIn, signedOut, ...props }) {
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    setIsSignedIn(hasSupabaseAuthCookie(document.cookie));
  }, []);

  const { href, label } = isSignedIn ? signedIn : signedOut;
  return (
    <Link href={href} {...props}>
      {label}
    </Link>
  );
}
