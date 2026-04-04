import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
    },
  },
  cloudflare: {
    customWorkerEntry: "./custom-worker.js",
  },
} satisfies OpenNextConfig;
