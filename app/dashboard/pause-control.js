"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { PAUSE_INDEFINITELY, pauseState, sevenDayPauseUntil } from "@/lib/preferences";

const OPTIONS = [
  {
    id: "active",
    label: "Active",
    desc: "Recaps arrive the morning after every game.",
  },
  {
    id: "timed",
    label: "Pause for 7 days",
    desc: "Recaps stop for a week, then resume automatically.",
  },
  {
    id: "indefinite",
    label: "Pause indefinitely",
    desc: "Recaps stop until you switch this back to Active.",
  },
];

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function PauseControl({ pausedUntil: initialPausedUntil }) {
  const [pausedUntil, setPausedUntil] = useState(initialPausedUntil ?? null);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const current = pauseState(pausedUntil);

  async function select(optionId) {
    if (optionId === current || pendingId) return;
    setPendingId(optionId);
    setError(null);

    const valueByOption = {
      active: null,
      timed: sevenDayPauseUntil(),
      indefinite: PAUSE_INDEFINITELY,
    };
    const nextValue = valueByOption[optionId];

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: writeError } = await supabase
      .from("mlb_user_preferences")
      .upsert(
        {
          user_id: user.id,
          notifications_paused_until: nextValue,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (writeError) {
      setError("Couldn't save that change. Please try again.");
      setPendingId(null);
      return;
    }

    setPausedUntil(nextValue);
    setPendingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4">
      <div role="radiogroup" aria-label="Recap email schedule" className="flex flex-col gap-2">
        {OPTIONS.map((option) => {
          const isActive = option.id === current;
          const isPending = option.id === pendingId;
          // The timed option is `isActive` only when `current === "timed"`, so
          // pausedUntil here is the live resume instant.
          const showResumeDate = isActive && option.id === "timed";
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={pendingId !== null}
              onClick={() => select(option.id)}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a7a5b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1311] disabled:cursor-not-allowed ${
                isActive
                  ? "border-[#4a7a5b] bg-[#0f2a1f]/80"
                  : "border-[#1f3a2c] bg-[#0f2a1f]/40 hover:border-[#4a7a5b] hover:bg-[#0f2a1f]/60"
              } ${pendingId !== null && !isPending ? "opacity-50" : ""}`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
                  isActive ? "border-[#5a9a6f]" : "border-[#3a5a47]"
                }`}
              >
                {isActive && (
                  <span className="h-2 w-2 rounded-full bg-[#5a9a6f]" />
                )}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-[#f7f5ef]">
                  {option.label}
                  {isPending && (
                    <span className="ml-2 text-xs font-normal text-[#a8a299]">
                      Saving…
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-[#a8a299]">
                  {showResumeDate
                    ? `Recaps resume ${dateFmt.format(new Date(pausedUntil))}.`
                    : option.desc}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[#e09b99]">
          {error}
        </p>
      )}
    </div>
  );
}
