import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  let isNewSignup = false;

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.created_at) {
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      isNewSignup = ageMs >= 0 && ageMs < 5 * 60 * 1000;
    }
  }

  const dest = new URL(`${origin}/dashboard`);
  if (isNewSignup) dest.searchParams.set("signup", "1");
  return NextResponse.redirect(dest);
}
