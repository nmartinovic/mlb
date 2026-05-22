"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

// Fires the highlights_page_viewed PostHog event once on mount. The page
// itself is a server component, so this mirrors the signup-tracker pattern:
// a tiny client island whose only job is the analytics call.
export default function HighlightsViewTracker({ gamePk, teamId }) {
  useEffect(() => {
    track("highlights_page_viewed", { game_pk: gamePk, team_id: teamId });
  }, [gamePk, teamId]);

  return null;
}
