"use client";

import { useEffect } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";

export default function DashboardError({ error, reset }) {
  useEffect(() => {
    console.error("Dashboard render failed:", error);
  }, [error]);

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
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-[#1f3a2c] bg-[#0f2a1f]/40 p-8 text-center"
        >
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f5ef]">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-[#a8a299]">
            We couldn&apos;t load your teams just now. This is usually a brief
            hiccup — try again in a moment.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-lg bg-[#2d5a3d] px-5 py-2.5 text-sm font-semibold text-[#f7f5ef] transition hover:bg-[#356b48] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7fb295] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1311]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="text-sm font-medium text-[#a8a299] underline-offset-4 transition hover:text-[#f7f5ef] hover:underline"
            >
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
