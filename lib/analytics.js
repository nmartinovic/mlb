"use client";

import posthog from "posthog-js";

let initialized = false;

function getKey() {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function getHost() {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
}

export function initAnalytics() {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const key = getKey();
  if (!key) return;
  posthog.init(key, {
    api_host: getHost(),
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function track(event, props) {
  if (!initialized || typeof window === "undefined") return;
  posthog.capture(event, props);
}

export function identify(distinctId, traits) {
  if (!initialized || typeof window === "undefined") return;
  posthog.identify(distinctId, traits);
}

export function resetAnalytics() {
  if (!initialized || typeof window === "undefined") return;
  posthog.reset();
}

export function isAnalyticsEnabled() {
  return initialized;
}
