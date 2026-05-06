"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
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
          className="text-sm font-semibold tracking-tight text-[#f5f1e6] hover:text-white transition"
        >
          Ninth Inning Email
        </Link>
        <Link
          href="/"
          className="text-sm text-[#a8a299] hover:text-[#f5f1e6] transition"
        >
          ← Back to home
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm rounded-2xl border border-[#1f3a2c] bg-[#0f2a1f]/40 p-8 shadow-2xl shadow-black/20">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#2d5240] bg-[#0f2a1f]/80 text-xl">
                ✉
              </div>
              <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#f5f1e6]">
                Check your email
              </h1>
              <p className="mt-3 text-sm text-[#a8a299]">
                We sent a magic link to{" "}
                <span className="text-[#f5f1e6]">{email}</span>. Click it to
                sign in.
              </p>
              <p className="mt-4 text-xs text-[#a8a299]/80">
                It can take a minute. Don&apos;t forget to check spam.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-center text-[#f5f1e6]">
                Sign in
              </h1>
              <p className="mt-2 text-center text-sm text-[#a8a299]">
                Enter your email and we&apos;ll send you a magic link.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-3">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#1f3a2c] bg-[#0a1410] px-4 py-3 text-sm text-[#f5f1e6] placeholder-[#a8a299]/60 focus:border-[#3f6e57] focus:outline-none focus:ring-2 focus:ring-[#0f5132]/40"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#c41e3a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#d92645] disabled:cursor-not-allowed disabled:opacity-60"
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
