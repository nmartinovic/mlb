// Injects the scheduled() handler into the OpenNext-generated worker.js
// Run after `opennextjs-cloudflare build` and before deploy.

import { readFileSync, writeFileSync } from "fs";

const workerPath = ".open-next/worker.js";
const worker = readFileSync(workerPath, "utf-8");

if (worker.includes("scheduled")) {
  console.log("scheduled handler already present, skipping injection.");
  process.exit(0);
}

const scheduledHandler = `
    async scheduled(event, env, ctx) {
        const url = \`\${env.SITE_URL}/api/cron\`;
        const res = await fetch(url, {
            headers: { Authorization: \`Bearer \${env.CRON_SECRET}\` },
        });
        const body = await res.text();
        console.log(\`Cron response (\${res.status}): \${body}\`);
    },`;

// Insert scheduled() right after the fetch() method's closing brace
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
