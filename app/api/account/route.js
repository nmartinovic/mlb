import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { deleteAccount } from "@/lib/delete-account";

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  try {
    const result = await deleteAccount({
      admin,
      userId: user.id,
      email: user.email,
    });
    // The auth.users row is gone, so the session is already dead server-side.
    // signOut clears the now-orphaned auth cookies so the browser doesn't keep
    // presenting a stale session after the redirect.
    await supabase.auth.signOut();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
