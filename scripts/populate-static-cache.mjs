// Copies the prerendered pages from the OpenNext build into the Worker's static
// assets, where the static-assets incremental cache (open-next.config.ts)
// reads them. Without this, prerendered pages are re-rendered on every request
// — over the Workers Free plan's 10ms CPU budget — and /teams/* (dynamicParams
// = false) would 404.
//
// `opennextjs-cloudflare deploy` / `preview` already do this copy, but
// production deploys through Cloudflare Builds' plain `wrangler deploy`, which
// skips it. Wired into wrangler.jsonc's build.command so every deploy path
// runs it. Mirrors populateStaticAssetsIncrementalCache in
// @opennextjs/cloudflare's populate-cache command; idempotent.

import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const outputDir = process.env.OPEN_NEXT_OUTPUT_DIR || ".open-next";
const source = join(outputDir, "cache");
// CACHE_DIR in @opennextjs/cloudflare's static-assets-incremental-cache.
const target = join(outputDir, "assets", "cdn-cgi", "_next_cache");

if (!existsSync(source)) {
  console.error(`ERROR: ${source} not found — run \`opennextjs-cloudflare build\` first.`);
  process.exit(1);
}

cpSync(source, target, { recursive: true });
console.log(`Populated static-assets incremental cache: ${source} → ${target}`);
