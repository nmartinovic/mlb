"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function PauseForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error

  async function handlePause() {
    setStatus("loading");
    const res = await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Recaps paused for 7 days</h1>
        <p className="mt-3 text-gray-400">
          You won&apos;t receive recap emails for the next week — they resume
          automatically after that. Your followed teams are unchanged. Want a
          different setting? Manage it anytime from your{" "}
          <a href="/dashboard" className="underline">
            dashboard
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">Pause for 7 days</h1>
      <p className="mt-3 text-gray-400">
        Click below to pause all recap emails for the next 7 days. Your teams
        stay followed and recaps resume automatically — no need to re-subscribe.
      </p>
      <button
        onClick={handlePause}
        disabled={status === "loading"}
        className="mt-6 rounded-lg bg-[#2d5a3d] px-6 py-3 text-sm font-semibold text-white hover:bg-[#356b49] disabled:opacity-50 transition"
      >
        {status === "loading" ? "Processing..." : "Pause for 7 days"}
      </button>
      {status === "error" && (
        <p className="mt-3 text-sm text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
    </div>
  );
}

export default function PausePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Suspense>
        <PauseForm />
      </Suspense>
    </main>
  );
}
