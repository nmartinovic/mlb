import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Serve prerendered pages (/, /teams/*, /privacy, …) straight from the build's
// static assets instead of re-rendering them on every request — the "dummy"
// cache used previously can't hold prerendered HTML, so every hit was a full
// React render, well over the Workers Free plan's 10ms CPU budget. Cache
// interception answers those requests before the Next.js server even loads.
//
// This cache is read-only: no ISR / `revalidate`. Pages with live data must be
// `export const dynamic = "force-dynamic"` (see /recaps, /highlights).
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
