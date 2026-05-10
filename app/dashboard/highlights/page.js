import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { TEAMS_BY_ID } from "@/lib/teams";
import { formatDisplayDate } from "@/lib/mlb";
import { BrandLockup } from "@/components/brand";

export default async function HighlightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userTeams } = await supabase
    .from("mlb_user_teams")
    .select("team_id")
    .eq("user_id", user.id);

  const followedTeamIds = (userTeams || []).map((r) => r.team_id);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let highlights = [];
  if (followedTeamIds.length > 0) {
    const { data } = await supabase
      .from("mlb_game_cache")
      .select("game_pk, team_id, game_date, highlight_url")
      .in("team_id", followedTeamIds)
      .not("highlight_url", "is", null)
      .gte("game_date", cutoffStr)
      .order("game_date", { ascending: false })
      .limit(50);
    highlights = data || [];
  }

  return (
    <>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          aria-label="ninthinning.email"
          className="text-[15px] text-[#f7f5ef] transition hover:opacity-90"
        >
          <BrandLockup glyphSize={26} dark />
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-[#a8a299] hover:text-[#f7f5ef] transition"
        >
          Your teams
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-16 pt-4">
        <h1 className="text-3xl font-bold tracking-tight text-[#f7f5ef] sm:text-4xl">
          Highlights
        </h1>
        <p className="mt-2 text-[#a8a299]">
          Recent game recaps for your followed teams (last 14 days).
        </p>

        <div className="mt-10">
          {followedTeamIds.length === 0 ? (
            <EmptyState
              title="No teams followed yet"
              body="Pick a team and we'll start dropping recaps here as soon as they play."
              cta={{ href: "/dashboard", label: "Choose your teams" }}
            />
          ) : highlights.length === 0 ? (
            <EmptyState
              title="No recaps yet"
              body="Recaps appear here within a few hours of the final out. Check back after your team's next game."
            />
          ) : (
            <div className="space-y-3">
              {highlights.map((game) => {
                const team = TEAMS_BY_ID[game.team_id];
                return (
                  <a
                    key={game.game_pk}
                    href={game.highlight_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-[#1f3a2c] bg-[#0f2a1f]/40 px-5 py-4 transition hover:border-[#4a7a5b] hover:bg-[#0f2a1f]/60"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-1 self-stretch rounded-full"
                        style={{ backgroundColor: team?.color || "#3f6e57" }}
                      />
                      <div>
                        <div className="text-sm font-medium text-[#f7f5ef]">
                          {team?.name || `Team ${game.team_id}`}
                        </div>
                        <div className="mt-0.5 text-xs text-[#a8a299]">
                          {formatDisplayDate(game.game_date)}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-[#a8a299] transition group-hover:text-[#f7f5ef]">
                      Watch recap →
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function EmptyState({ title, body, cta }) {
  return (
    <div className="rounded-2xl border border-[#1f3a2c] bg-[#0f2a1f]/30 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-[#f7f5ef]">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[#a8a299]">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-block rounded-lg bg-[#b8312f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a02825]"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
