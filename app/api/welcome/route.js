import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: teams, error: teamsError } = await admin
    .from("mlb_user_teams")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1);

  if (teamsError) {
    return NextResponse.json(
      { error: `Failed to read teams: ${teamsError.message}` },
      { status: 500 }
    );
  }

  if (!teams || teams.length === 0) {
    return NextResponse.json({ sent: false, reason: "no_teams" });
  }

  try {
    const result = await sendWelcomeEmailIfNeeded({
      supabase: admin,
      userId: user.id,
      email: user.email,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
