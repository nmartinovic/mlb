// Email-preference helpers (#22).
//
// `notifications_paused_until` in mlb_user_preferences gates recap sends in
// runMainCron:
//   null / past instant -> active: recaps send normally
//   future instant      -> paused: the cron skips this user
//
// "Pause for 7 days" stores now()+7d; "Pause indefinitely" stores the
// far-future sentinel below. The dashboard reads the value back through
// pauseState() to tell an indefinite pause apart from a timed one without
// needing an exact-string match (Postgres normalizes timestamptz formatting).

export const PAUSE_INDEFINITELY = "9999-12-31T00:00:00.000Z";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Anything further out than this is treated as an indefinite pause. A timed
// pause is only ever 7 days, so the gap is large and unambiguous.
const INDEFINITE_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

// ISO timestamp 7 days from `now`, the value a "Pause for 7 days" action writes.
export function sevenDayPauseUntil(now = Date.now()) {
  return new Date(now + SEVEN_DAYS_MS).toISOString();
}

// Maps a stored notifications_paused_until value to a UI state:
// "active" | "timed" | "indefinite".
export function pauseState(pausedUntil, now = Date.now()) {
  if (!pausedUntil) return "active";
  const until = new Date(pausedUntil).getTime();
  if (Number.isNaN(until) || until <= now) return "active";
  if (until > now + INDEFINITE_THRESHOLD_MS) return "indefinite";
  return "timed";
}
