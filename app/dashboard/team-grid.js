"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

export default function TeamGrid({ teams, followedIds: initialFollowed }) {
  const [followed, setFollowed] = useState(new Set(initialFollowed));
  const [, startTransition] = useTransition();
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
            aria-label={`${isActive ? "Unfollow" : "Follow"} ${team.name}`}
            className={`group relative flex min-h-[64px] w-full flex-col justify-center overflow-hidden rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1410] ${
              isActive
                ? "border-transparent text-[#f5f1e6] shadow-lg shadow-black/30"
                : "border-[#1f3a2c] bg-[#0f2a1f]/40 text-[#a8a299] hover:border-[#3f6e57] hover:bg-[#0f2a1f]/60 hover:text-[#f5f1e6]"
            }`}
            style={
              isActive
                ? {
                    backgroundColor: team.color,
                    // Use the team color as the focus ring on selected cards
                    // so the visible state and the focus state agree.
                    "--tw-ring-color": team.color,
                  }
                : undefined
            }
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
            <span className="mt-0.5 block truncate text-[15px]">
              {team.shortName}
            </span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute right-2 top-2 text-xs font-bold text-white/95"
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
