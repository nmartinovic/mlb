import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config for the staging dry-run smoke test only (#180). Run via
// `npm run test:staging`. The default config (vitest.config.mjs) deliberately
// EXCLUDES *.staging.test.* so live MLB API / staging-Supabase flakiness can
// never block the deterministic `npm test` / predeploy gate.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.staging.test.{js,mjs}"],
    exclude: ["node_modules/**", ".next/**", ".open-next/**"],
  },
});
