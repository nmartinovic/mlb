// Demo-only route used by the product-demo recorder (scripts/demo/) to
// screenshot the dashboard UI without an auth session. Gated to development
// so it does not ship to the Cloudflare worker — see issue #127.
import Link from "next/link";
import { notFound } from "next/navigation";
import { MLB_TEAMS } from "@/lib/teams";
import { BrandLockup } from "@/components/brand";

export default function DemoDashboardPage({ searchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  const followedIds = new Set(
    (searchParams?.followed || "").split(",").filter(Boolean).map((s) => parseInt(s, 10)),
  );
  const followedCount = followedIds.size;
  const fakeEmail = "you@example.com";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="ninthinning.email" className="text-[15px] text-[#f7f5ef]">
          <BrandLockup glyphSize={28} dark />
        </Link>
        <span className="text-sm font-medium text-[#a8a299]">Sign out</span>
      </header>

      <main className="flex-1">
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
            <h1 className="text-3xl font-bold tracking-tight text-[#f7f5ef] sm:text-4xl">
              Your teams
            </h1>
            <p className="mt-2 text-[#a8a299]">
              Tap any team to follow — we&apos;ll email a spoiler-free recap the
              morning after each game.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <span className="text-[#a8a299]/80">
                Signed in as <span className="text-[#f7f5ef]">{fakeEmail}</span>
              </span>
              <span className="rounded-full border border-[#1f3a2c] bg-[#0f2a1f]/60 px-2.5 py-1 font-medium text-[#a8a299]">
                {followedCount === 0
                  ? "No teams selected"
                  : `Following ${followedCount} team${followedCount === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {MLB_TEAMS.map((team) => {
                const isActive = followedIds.has(team.id);
                return (
                  <div
                    key={team.id}
                    className={`group relative flex min-h-[64px] w-full flex-col justify-center overflow-hidden rounded-xl border px-4 py-3 text-left text-sm font-medium ${
                      isActive
                        ? "border-transparent text-[#f7f5ef] shadow-lg shadow-black/30"
                        : "border-[#1f3a2c] bg-[#0f2a1f]/40 text-[#a8a299]"
                    }`}
                    style={isActive ? { backgroundColor: team.color } : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: isActive ? "rgba(255,255,255,0.6)" : team.color }}
                    />
                    <span
                      className={`block text-[11px] font-semibold uppercase tracking-wider ${
                        isActive ? "text-white/90" : "text-[#a8a299]/80"
                      }`}
                    >
                      {team.abbr}
                    </span>
                    <span className="mt-0.5 block truncate text-[15px]">{team.shortName}</span>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute right-2 top-2 text-xs font-bold text-white/95"
                      >
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
