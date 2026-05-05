"use client";

import { useEffect } from "react";
import { initAnalytics, identify, resetAnalytics } from "@/lib/analytics";

export default function PostHogProvider({ userId, userEmail }) {
  useEffect(() => {
    initAnalytics();
    if (userId) {
      identify(userId, userEmail ? { email: userEmail } : undefined);
    } else {
      resetAnalytics();
    }
  }, [userId, userEmail]);

  return null;
}
