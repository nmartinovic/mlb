import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/unsubscribe-token";

export async function POST(request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const userId = await verifyToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("mlb_user_teams")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
