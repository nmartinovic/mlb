import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { TEAMS_BY_ID } from "@/lib/teams";
import { formatDisplayDate } from "@/lib/mlb";

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Highlights</h1>
          <p className="mt-1 text-sm text-gray-400">
            Recent game recaps for your followed teams (last 14 days)
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-300 transition"
        >
          Your teams
        </Link>
      </div>

      {followedTeamIds.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>You&apos;re not following any teams yet.</p>
          <Link
            href="/dashboard"
            className="mt-2 inline-block text-blue-400 hover:underline"
          >
            Choose your teams
          </Link>
        </div>
      ) : highlights.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No highlights found in the last 14 days for your teams.</p>
        </div>
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
                className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-5 py-4 hover:border-gray-500 transition"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-1 self-stretch rounded-full"
                    style={{ backgroundColor: team?.color || "#555" }}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-200">
                      {team?.name || `Team ${game.team_id}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatDisplayDate(game.game_date)}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-blue-400 shrink-0">
                  Watch recap →
                </span>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
