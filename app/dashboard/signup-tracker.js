"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

export default function SignupTracker() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("signup") !== "1") return;
    track("signup_completed");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("signup");
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : "/dashboard");
  }, [searchParams, router]);

  return null;
}
