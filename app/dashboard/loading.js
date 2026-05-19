import Link from "next/link";
import { BrandLockup } from "@/components/brand";

const SKELETON_TEAM_COUNT = 30;

export default function DashboardLoading() {
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
        <span className="text-sm font-medium text-[#a8a299]/60">Sign out</span>
      </header>

      <main className="flex-1" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading your teams…</span>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(15,81,50,0.45), transparent 70%)",
            }}
            aria-hidden="true"
          />
          <div className="mx-auto max-w-3xl px-6 pb-16 pt-4 sm:pt-8">
            <div className="h-9 w-48 animate-pulse rounded-md bg-[#1f3a2c]/60 sm:h-10" />
            <div className="mt-3 h-5 w-full max-w-md animate-pulse rounded-md bg-[#1f3a2c]/40" />

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="h-4 w-44 animate-pulse rounded bg-[#1f3a2c]/40" />
              <div className="h-6 w-32 animate-pulse rounded-full bg-[#0f2a1f]/70" />
              <div className="h-4 w-40 animate-pulse rounded bg-[#1f3a2c]/40" />
            </div>

            <div
              className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              aria-hidden="true"
            >
              {Array.from({ length: SKELETON_TEAM_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="min-h-[64px] animate-pulse rounded-xl border border-[#1f3a2c] bg-[#0f2a1f]/40"
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
