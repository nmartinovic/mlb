import { createAdminClient } from "@/lib/supabase-admin";
import { sevenDayPauseUntil } from "@/lib/preferences";
import { NextResponse } from "next/server";

// Pause recap emails for 7 days via an email-footer link — no login required
// (#22). Mirrors /api/unsubscribe: the token is the user's ID, encoded in the
// link. Idempotent — re-hitting it just re-extends the 7-day window.
export async function POST(request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Upsert so a user with no preferences row yet still pauses cleanly.
  const { error } = await supabase.from("mlb_user_preferences").upsert(
    {
      user_id: token,
      notifications_paused_until: sevenDayPauseUntil(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
