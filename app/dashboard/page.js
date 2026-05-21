import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { MLB_TEAMS } from "@/lib/teams";
import TeamGrid from "./team-grid";
import SignupTracker from "./signup-tracker";
import DeleteAccount from "./delete-account";
import { Suspense } from "react";
import pkg from "../../package.json";
import { BrandLockup } from "@/components/brand";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userTeams, error: userTeamsError } = await supabase
    .from("mlb_user_teams")
    .select("team_id")
    .eq("user_id", user.id);

  if (userTeamsError) {
    // Surface to the error boundary at app/dashboard/error.js so the user
    // sees a recoverable retry UI rather than a silent empty grid.
    throw new Error(`Failed to load followed teams: ${userTeamsError.message}`);
  }

  const followedIds = new Set((userTeams || []).map((r) => r.team_id));
  const followedCount = followedIds.size;
  const tipUrl = process.env.TIP_URL;

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
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="text-sm font-medium text-[#a8a299] transition hover:text-[#f7f5ef]"
          >
            Sign out
          </button>
        </form>
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
            <Suspense fallback={null}>
              <SignupTracker />
            </Suspense>

            <h1 className="text-3xl font-bold tracking-tight text-[#f7f5ef] sm:text-4xl">
              Your teams
            </h1>
            <p className="mt-2 text-[#a8a299]">
              Tap any team to follow — we&apos;ll email a spoiler-free recap the
              morning after each game.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <span className="text-[#a8a299]/80">
                Signed in as{" "}
                <span className="text-[#f7f5ef]">{user.email}</span>
              </span>
              <span className="rounded-full border border-[#1f3a2c] bg-[#0f2a1f]/60 px-2.5 py-1 font-medium text-[#a8a299]">
                {followedCount === 0
                  ? "No teams selected"
                  : `Following ${followedCount} team${followedCount === 1 ? "" : "s"}`}
              </span>
              <Link
                href="/dashboard/highlights"
                className="font-medium text-[#a8a299] underline-offset-4 transition hover:text-[#f7f5ef] hover:underline"
              >
                View recent highlights →
              </Link>
            </div>

            {followedCount === 0 && (
              <div
                role="status"
                className="mt-8 rounded-2xl border border-[#1f3a2c] bg-[#0f2a1f]/40 px-5 py-4 text-sm text-[#a8a299]"
              >
                <p className="font-semibold text-[#f7f5ef]">
                  Pick your first team to get started
                </p>
                <p className="mt-1">
                  Tap any team below and we&apos;ll start sending spoiler-free
                  recaps the morning after every game.
                </p>
              </div>
            )}

            <TeamGrid teams={MLB_TEAMS} followedIds={[...followedIds]} />

            <div className="mt-16 border-t border-[#1f3a2c] pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a8a299]">
                Account
              </h2>
              <p className="mt-2 max-w-prose text-sm text-[#a8a299]">
                Deleting your account permanently removes your email address,
                the teams you follow, and your recap history. This can&apos;t be
                undone — to simply stop emails without losing your account, use
                the unsubscribe link instead.
              </p>
              <DeleteAccount />
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-[#1f3a2c]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-[#a8a299] sm:flex-row">
          <p className="text-center sm:text-left">
            Ninth Inning Email is not affiliated with, endorsed by, or
            sponsored by MLB or any MLB club. Video links courtesy of MLB.com.
          </p>
          <div className="flex items-center gap-5">
            {tipUrl && (
              <a
                href={tipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-[#f7f5ef]"
              >
                Tip the developer
              </a>
            )}
            <Link
              href="/unsubscribe"
              className="transition hover:text-[#f7f5ef]"
            >
              Unsubscribe
            </Link>
            <span className="text-[#a8a299]/60">v{pkg.version}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
