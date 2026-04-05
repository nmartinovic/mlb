// Injects the scheduled() handler into the OpenNext-generated worker.js
// Run after `opennextjs-cloudflare build` and before deploy.

import { readFileSync, writeFileSync } from "fs";

const workerPath = ".open-next/worker.js";
const worker = readFileSync(workerPath, "utf-8");

if (worker.includes("scheduled")) {
  console.log("scheduled handler already present, skipping injection.");
  process.exit(0);
}

// Call the worker's own fetch handler directly instead of making an external
// HTTP request, which hits Cloudflare error 1042 (self-referencing route).
const scheduledHandler = `
    async scheduled(event, env, ctx) {
        try {
            const request = new Request("https://dummy/api/cron", {
                headers: { Authorization: \`Bearer \${env.CRON_SECRET}\` },
            });
            const response = await this.fetch(request, env, ctx);
            const body = await response.text();
            console.log(\`Cron response (\${response.status}): \${body}\`);
        } catch (err) {
            console.error(\`Cron handler error: \${err.message}\`);
        }
    },`;

// Insert scheduled() right before the fetch() method
const patched = worker.replace(
  /async fetch\(request, env, ctx\) \{/,
  `${scheduledHandler}\n    async fetch(request, env, ctx) {`
);

if (patched === worker) {
  console.error("ERROR: Could not find insertion point in worker.js");
  process.exit(1);
}

writeFileSync(workerPath, patched);
console.log("Injected scheduled() handler into worker.js");
