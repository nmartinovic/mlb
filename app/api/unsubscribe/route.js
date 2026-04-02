import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function POST(request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // The token is the user's ID, signed/encoded in the email link.
  // For MVP, we use the user ID directly. In production, use a signed JWT.
  const { error } = await supabase
    .from("mlb_user_teams")
    .delete()
    .eq("user_id", token);

  if (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
