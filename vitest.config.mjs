import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.{js,mjs}"],
    // *.staging.test.* runs only via `npm run test:staging`
    // (vitest.staging.config.mjs) — it makes live network calls and must not
    // gate the deterministic `npm test` / predeploy run. See #180.
    exclude: [
      "node_modules/**",
      ".next/**",
      ".open-next/**",
      "**/*.staging.test.{js,mjs}",
    ],
  },
});
