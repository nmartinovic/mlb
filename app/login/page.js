"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BrandLockup } from "@/components/brand";

function LoginForm() {
  const searchParams = useSearchParams();
  const isSignup = searchParams.get("next") === "signup";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let res;
    try {
      res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
      return;
    }

    setLoading(false);

    if (res.status === 429) {
      setError("Too many requests. Please wait a minute and try again.");
      return;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Could not send magic link.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          aria-label="ninthinning.email"
          className="text-[15px] text-[#f7f5ef] transition hover:opacity-90"
        >
          <BrandLockup glyphSize={28} dark />
        </Link>
        <Link
          href="/"
          className="text-sm text-[#a8a299] hover:text-[#f7f5ef] transition"
        >
          ← Back to home
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm rounded-2xl border border-[#1f3a2c] bg-[#0f2a1f]/40 p-8 shadow-2xl shadow-black/20">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#3f6e57] bg-[#0f2a1f]/80 text-xl">
                ✉
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#f7f5ef]">
                Check your email
              </h1>
              <p className="mt-3 text-sm text-[#a8a299]">
                We sent a magic link to{" "}
                <span className="text-[#f7f5ef]">{email}</span>. Click it to
                sign in.
              </p>
              <p className="mt-4 text-xs text-[#a8a299]/80">
                It usually arrives within a minute. If you don&apos;t see it,
                check your spam folder &mdash; the email is from{" "}
                <span className="text-[#a8a299]">
                  highlights@ninthinning.email
                </span>
                .
              </p>
              <p className="mt-5 text-xs text-[#a8a299]/80">
                Wrong address?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                  className="underline hover:text-[#f7f5ef] transition"
                >
                  Try another email
                </button>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-center text-[#f7f5ef]">
                {isSignup ? "Get your recaps" : "Sign in"}
              </h1>
              <p className="mt-2 text-center text-sm text-[#a8a299]">
                {isSignup
                  ? "Enter your email — we'll send a magic link, then you can pick your teams."
                  : "Enter your email and we'll send you a magic link."}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#1f3a2c] bg-[#0f1311] px-4 py-3 text-sm text-[#f7f5ef] placeholder-[#a8a299]/60 focus:border-[#4a7a5b] focus:outline-none focus:ring-2 focus:ring-[#2d5a3d]/40"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#b8312f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#a02825] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send magic link"}
                </button>
                {error && (
                  <p className="text-center text-sm text-red-400">{error}</p>
                )}
              </form>

              <p className="mt-5 text-center text-xs text-[#a8a299]">
                No password. No tracking pixel. Free forever.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
