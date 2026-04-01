import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { MLB_TEAMS } from "@/lib/teams";
import TeamGrid from "./team-grid";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userTeams } = await supabase
    .from("user_teams")
    .select("team_id")
    .eq("user_id", user.id);

  const followedIds = new Set((userTeams || []).map((r) => r.team_id));

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your teams</h1>
          <p className="mt-1 text-sm text-gray-400">
            Pick the teams you want to receive highlight recaps for.
          </p>
        </div>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="mt-1 text-xs text-gray-600">Signed in as {user.email}</p>

      <TeamGrid teams={MLB_TEAMS} followedIds={[...followedIds]} />
    </main>
  );
}
