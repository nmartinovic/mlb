"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

export default function TeamGrid({ teams, followedIds: initialFollowed }) {
  const [followed, setFollowed] = useState(new Set(initialFollowed));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle(teamId) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const isFollowing = followed.has(teamId);

    // Optimistic update
    const next = new Set(followed);
    if (isFollowing) {
      next.delete(teamId);
    } else {
      next.add(teamId);
    }
    setFollowed(next);

    if (isFollowing) {
      await supabase
        .from("mlb_user_teams")
        .delete()
        .eq("user_id", user.id)
        .eq("team_id", teamId);
      track("team_deselected", { team_id: teamId });
    } else {
      await supabase
        .from("mlb_user_teams")
        .insert({ user_id: user.id, team_id: teamId });
      track("team_selected", { team_id: teamId });
    }

    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {teams.map((team) => {
        const isActive = followed.has(team.id);
        return (
          <button
            key={team.id}
            onClick={() => toggle(team.id)}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              isActive
                ? "border-blue-500 bg-blue-950 text-blue-300"
                : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500"
            }`}
          >
            <span className="block text-xs text-gray-500">{team.abbr}</span>
            <span className="block truncate">
              {team.name.replace(/^(.*?)\s/, "")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
