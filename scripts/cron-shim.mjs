// Build-time shim that exposes the cron entry points on globalThis so the
// injected scheduled() handler can call them directly instead of going
// through this.fetch() (#157). Bundled by scripts/inject-scheduled.mjs and
// prepended to .open-next/worker.js — not loaded by Next.js at runtime.

import { runMainCron, runScheduler } from "@/lib/cron-jobs";
import { createAdminClient } from "@/lib/supabase-admin";

globalThis.__ninthInningCron = {
  runMainCron,
  runScheduler,
  createAdminClient,
};
