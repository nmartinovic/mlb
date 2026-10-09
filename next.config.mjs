import { readFileSync } from "node:fs";

// TIP_URL is a public Wrangler `vars` entry, i.e. a runtime binding — but the
// homepage is prerendered at build time, where runtime bindings don't exist.
// Inline it at build from wrangler.jsonc so that file stays the single source
// of truth (changing it already requires a redeploy). A shell env value wins.
function wranglerVar(name) {
  try {
    const src = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf-8");
    return src.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))?.[1];
  } catch {
    return undefined;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TIP_URL: process.env.TIP_URL ?? wranglerVar("TIP_URL") ?? "",
  },
};

export default nextConfig;
