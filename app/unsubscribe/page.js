"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error

  async function handleUnsubscribe() {
    setStatus("loading");
    const res = await fetch("/api/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Unsubscribed</h1>
        <p className="mt-3 text-gray-400">
          You've been unsubscribed and won't receive any more highlight emails.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Unsubscribe</h1>
      <p className="mt-3 text-gray-400">
        Click below to stop receiving game highlight emails.
      </p>
      <button
        onClick={handleUnsubscribe}
        disabled={status === "loading"}
        className="mt-6 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition"
      >
        {status === "loading" ? "Processing..." : "Unsubscribe"}
      </button>
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Suspense>
        <UnsubscribeForm />
      </Suspense>
    </main>
  );
}
