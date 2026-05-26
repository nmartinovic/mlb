"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import { TEAMS_BY_SLUG } from "@/lib/teams";

export default function TeamGrid({ teams, followedIds: initialFollowed }) {
  const [followed, setFollowed] = useState(new Set(initialFollowed));
  const [, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectHandled = useRef(false);

  // Pre-select from /teams/[slug] CTA. The team-landing pages (#195) thread a
  // ?team=<slug> param through login → callback → here; if the user isn't
  // already following that team we follow it once and strip the param so a
  // refresh doesn't re-trigger.
  useEffect(() => {
    if (preselectHandled.current) return;
    const slug = searchParams.get("team");
    if (!slug) return;
    preselectHandled.current = true;
    const team = TEAMS_BY_SLUG[slug];
    const params = new URLSearchParams(searchParams.toString());
    params.delete("team");
    const nextUrl = params.toString() ? `/dashboard?${params}` : "/dashboard";
    if (team && !followed.has(team.id)) {
      toggle(team.id).finally(() => router.replace(nextUrl));
    } else {
      router.replace(nextUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            className={`group relative flex min-h-[64px] w-full flex-col justify-center overflow-hidden rounded-xl border px-4 py-3 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1311] ${
              isActive
                ? "border-transparent text-[#f7f5ef] shadow-lg shadow-black/30"
                : "border-[#1f3a2c] bg-[#0f2a1f]/40 text-[#a8a299] hover:border-[#4a7a5b] hover:bg-[#0f2a1f]/60 hover:text-[#f7f5ef]"
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
