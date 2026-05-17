import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Drives scripts/inject-scheduled.mjs against a synthetic worker.js and
// asserts the patched output has the right shape. Exists because the
// 2026-05-17 incident (#154) traced back to scheduled() using the HTTP
// wall-clock instead of the scheduled-event budget — the inject script is
// the only thing that wires up scheduled(), so a regression here is a
// silent recipe for the same problem (#157).

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const injectScript = join(repoRoot, "scripts/inject-scheduled.mjs");

let workDir;
let workerPath;

const SYNTHETIC_WORKER = `// synthetic OpenNext output for tests
export default {
    async fetch(request, env, ctx) {
        return new Response("hello");
    },
};
`;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "inject-scheduled-"));
  workerPath = join(workDir, "worker.js");
  writeFileSync(workerPath, SYNTHETIC_WORKER);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runInject() {
  return execFileSync("node", [injectScript], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: {
      ...process.env,
      // Point the script at our temp worker.js by symlinking via a relative
      // override. The script reads ".open-next/worker.js" relative to cwd —
      // we expose the temp file at that path via the env var below, which
      // the test-only branch in the script honors.
      OPEN_NEXT_WORKER_PATH: workerPath,
    },
  });
}

describe("inject-scheduled", () => {
  it("injects a scheduled() handler that does NOT call this.fetch", () => {
    runInject();
    const patched = readFileSync(workerPath, "utf-8");

    expect(patched).toContain("async scheduled(event, env, ctx)");
    // The whole point of #157: stop doing internal HTTP. If a future edit
    // brings this.fetch() back inside scheduled(), this test fails loudly.
    // Slice from `async scheduled` to the next `async fetch` after it (the
    // bundled IIFE shim has its own async fetch methods earlier in the file).
    const scheduledIdx = patched.indexOf("async scheduled");
    const scheduledBlock = patched.slice(
      scheduledIdx,
      patched.indexOf("async fetch", scheduledIdx)
    );
    expect(scheduledBlock).not.toContain("this.fetch");
    expect(scheduledBlock).not.toContain("new Request");
  });

  it("wires scheduled() to ctx.waitUntil so it gets the 15-min cron budget", () => {
    runInject();
    const patched = readFileSync(workerPath, "utf-8");
    expect(patched).toContain("ctx.waitUntil");
  });

  it("routes the 9am ET cron to runScheduler and others to runMainCron", () => {
    runInject();
    const patched = readFileSync(workerPath, "utf-8");
    expect(patched).toContain('"0 13 * * *"');
    expect(patched).toContain("runScheduler");
    expect(patched).toContain("runMainCron");
  });

  it("prepends the cron shim that registers __ninthInningCron on globalThis", () => {
    runInject();
    const patched = readFileSync(workerPath, "utf-8");
    expect(patched).toContain("__ninthInningCron");
    // Shim must register __ninthInningCron *before* the injected scheduled()
    // handler, so the handler can find the symbols on first invocation.
    // (We can't anchor on "async fetch" because the bundled supabase client
    //  contains async fetch methods of its own.)
    expect(patched.indexOf("__ninthInningCron")).toBeLessThan(
      patched.indexOf("async scheduled")
    );
  });

  it("passes env directly to the bundled cron functions instead of bridging process.env (#163)", () => {
    runInject();
    const patched = readFileSync(workerPath, "utf-8");
    const scheduledIdx = patched.indexOf("async scheduled");
    const scheduledBlock = patched.slice(
      scheduledIdx,
      patched.indexOf("async fetch", scheduledIdx)
    );
    // The supabase URL/key come straight off env, not process.env. The earlier
    // process.env bridge silently failed in workerd because the bundled IIFE
    // shim doesn't see writes made from this injected handler — #163.
    expect(scheduledBlock).toContain("env.NEXT_PUBLIC_SUPABASE_URL");
    expect(scheduledBlock).toContain("env.SUPABASE_SERVICE_ROLE_KEY");
    // runMainCron receives env so it can thread EMAIL_API_KEY / FROM_EMAIL /
    // SITE_URL / TIP_URL to brevo + email-template.
    expect(scheduledBlock).toMatch(/runMainCron\(\{[^}]*env[^}]*\}\)/s);
    // The doomed process.env bridge must stay gone.
    expect(scheduledBlock).not.toContain("process.env[");
    expect(scheduledBlock).not.toContain("Object.entries(env)");
  });

  it("is idempotent — running it twice does not double-inject", () => {
    runInject();
    const once = readFileSync(workerPath, "utf-8");
    runInject();
    const twice = readFileSync(workerPath, "utf-8");
    expect(twice).toBe(once);
  });
});
