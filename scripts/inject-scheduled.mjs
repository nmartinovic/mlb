// Injects the scheduled() handler into the OpenNext-generated worker.js.
// Run after `opennextjs-cloudflare build` and before deploy (wired via
// wrangler.jsonc's build.command and the `npm run deploy` script).
//
// Why this isn't a one-liner: the scheduled handler needs to call our cron
// entry points (runMainCron / runScheduler from lib/cron-jobs.js) without
// round-tripping through this.fetch(). That HTTP self-call was the previous
// approach but it inherits the ~30s HTTP request wall-clock instead of the
// 15-min scheduled-event budget — a tighter envelope than the work needs
// (see postmortem #154 and the follow-up in #157).
//
// Two pieces are injected:
//   1. A "cron shim" (scripts/cron-shim.mjs) bundled with esbuild and
//      prepended to worker.js. It registers runMainCron, runScheduler, and
//      createAdminClient on globalThis.__ninthInningCron at worker startup,
//      bringing those symbols out of the (bundled, internal) module graph.
//   2. A scheduled() method on the worker's default export. It reads the
//      shim's functions from globalThis, bridges Worker secrets into
//      process.env (mirroring OpenNext's populateProcessEnv — see
//      node_modules/@opennextjs/cloudflare/dist/cli/templates/init.js — which
//      the fetch wrapper does for us but the scheduled handler bypasses), and
//      hands the long-running work to ctx.waitUntil() so it gets the 15-min
//      scheduled-event budget.
//
// The /api/cron and /api/cron/schedule HTTP routes are unchanged: the
// /admin break-glass buttons (#110) and any human curl-based recovery still
// go through them. We just no longer share that path with the cron trigger.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import esbuild from "esbuild";

// OPEN_NEXT_WORKER_PATH lets the test harness point at a synthetic worker
// in a tempdir; the deploy pipeline always uses the default.
const workerPath = process.env.OPEN_NEXT_WORKER_PATH || ".open-next/worker.js";
const worker = readFileSync(workerPath, "utf-8");

const INJECTION_MARKER = "__ninthInningCron";

if (worker.includes(INJECTION_MARKER)) {
  console.log("Cron shim already present, skipping injection.");
  process.exit(0);
}

// Bundle the shim so cron-jobs and its deps (including @supabase/supabase-js)
// end up as plain JS reachable from the worker's top-level scope. IIFE format
// wraps everything in a self-scoped function so minified identifiers can't
// collide with worker.js's own minified bindings when the two are concatenated.
const result = await esbuild.build({
  entryPoints: ["scripts/cron-shim.mjs"],
  bundle: true,
  format: "iife",
  platform: "neutral",
  conditions: ["workerd", "worker", "browser"],
  mainFields: ["browser", "module", "main"],
  target: "es2022",
  write: false,
  alias: { "@": resolve(".") },
  legalComments: "none",
  logLevel: "warning",
  minify: true,
});

const shimCode = result.outputFiles[0].text;

// Two cron triggers are wired in wrangler.jsonc (#76):
//   - "*/15 * * * *" → runMainCron
//   - "0 13 * * *"   → runScheduler
// Anything we don't recognise falls through to runMainCron so a misconfigured
// trigger doesn't silently drop the run.
const scheduledHandler = `
    async scheduled(event, env, ctx) {
        const cron = globalThis.__ninthInningCron;
        if (!cron) {
            console.error("scheduled() invoked before cron shim loaded — bundle is broken");
            return;
        }
        // Mirror OpenNext's populateProcessEnv: the fetch wrapper bridges Worker
        // secrets into process.env on the first request, but scheduled() bypasses
        // that wrapper entirely. lib/cron-jobs.js → lib/brevo.js / supabase-admin
        // read process.env directly, so populate it before invoking either job.
        for (const [k, v] of Object.entries(env)) {
            if (typeof v === "string") process.env[k] = v;
        }
        const job = event.cron === "0 13 * * *" ? "schedule" : "main";
        const work = (async () => {
            try {
                const supabase = cron.createAdminClient();
                const result = job === "schedule"
                    ? await cron.runScheduler({ supabase })
                    : await cron.runMainCron({
                        supabase,
                        emailsPaused: env.EMAILS_PAUSED === "true",
                    });
                console.log(\`Cron \${job} status \${result.status}\`);
            } catch (err) {
                console.error(\`Cron \${job} handler error:\`, err && (err.stack || err.message) || err);
            }
        })();
        ctx.waitUntil(work);
    },`;

const patched = worker.replace(
  /async fetch\(request, env, ctx\) \{/,
  `${scheduledHandler}\n    async fetch(request, env, ctx) {`
);

if (patched === worker) {
  console.error("ERROR: Could not find insertion point in worker.js");
  process.exit(1);
}

// Prepend the bundled shim so globalThis.__ninthInningCron is populated at
// worker startup, before any scheduled() invocation can reach for it. ESM
// imports hoist, so prepending text doesn't reorder the worker's own imports.
writeFileSync(workerPath, `${shimCode}\n${patched}`);
console.log("Injected cron shim + scheduled() handler into worker.js");
