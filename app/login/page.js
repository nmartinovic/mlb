"use client";

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

  if (sent) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="mt-3 text-gray-400">
            We sent a magic link to <span className="text-white">{email}</span>.
            Click it to sign in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Sign in</h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          Enter your email and we'll send you a magic link.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}
        </form>
      </div>
    </main>
  );
}
