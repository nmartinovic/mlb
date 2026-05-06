import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { MLB_TEAMS } from "@/lib/teams";
import TeamGrid from "./team-grid";
import SignupTracker from "./signup-tracker";
import { Suspense } from "react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userTeams } = await supabase
    .from("mlb_user_teams")
    .select("team_id")
    .eq("user_id", user.id);

  const followedIds = new Set((userTeams || []).map((r) => r.team_id));
  const followedCount = followedIds.size;

  return (
    <>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-[#f5f1e6] hover:text-white transition"
        >
          Ninth Inning Email
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="text-sm text-[#a8a299] hover:text-[#f5f1e6] transition"
          >
            Sign out
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-4">
        <Suspense fallback={null}>
          <SignupTracker />
        </Suspense>

        <h1 className="text-3xl font-bold tracking-tight text-[#f5f1e6] sm:text-4xl">
          Your teams
        </h1>
        <p className="mt-2 text-[#a8a299]">
          Tap any team to follow — we&apos;ll email a spoiler-free recap the
          morning after each game.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="text-[#a8a299]/80">
            Signed in as{" "}
            <span className="text-[#f5f1e6]">{user.email}</span>
          </span>
          <span className="rounded-full border border-[#1f3a2c] bg-[#0f2a1f]/60 px-2.5 py-1 font-medium text-[#a8a299]">
            {followedCount === 0
              ? "No teams selected"
              : `Following ${followedCount} team${followedCount === 1 ? "" : "s"}`}
          </span>
          <Link
            href="/dashboard/highlights"
            className="font-medium text-[#a8a299] underline-offset-4 hover:text-[#f5f1e6] hover:underline transition"
          >
            View recent highlights →
          </Link>
        </div>

        <TeamGrid teams={MLB_TEAMS} followedIds={[...followedIds]} />
      </main>
    </>
  );
}
