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
      // Fire-and-forget: the API route is idempotent (sentinel row in
      // mlb_sent_notifications), so calling on every add is safe and only
      // the first one sends mail.
      fetch("/api/welcome", { method: "POST" }).catch(() => {});
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
            aria-pressed={isActive}
            className={`group relative overflow-hidden rounded-lg border px-4 py-3 text-left text-sm font-medium transition ${
              isActive
                ? "border-transparent text-[#f5f1e6] shadow-lg shadow-black/30"
                : "border-[#1f3a2c] bg-[#0f2a1f]/40 text-[#a8a299] hover:border-[#3f6e57] hover:text-[#f5f1e6]"
            }`}
            style={
              isActive
                ? { backgroundColor: team.color }
                : undefined
            }
          >
            <span
              className={`block text-[11px] font-semibold uppercase tracking-wider ${
                isActive ? "text-white/80" : "text-[#a8a299]/70"
              }`}
            >
              {team.abbr}
            </span>
            <span className="mt-0.5 block truncate">{team.shortName}</span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 text-xs text-white/90"
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
