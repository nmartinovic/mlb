import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("./populate-static-cache.mjs", import.meta.url));

function run(outputDir) {
  return execFileSync(process.execPath, [script], {
    env: { ...process.env, OPEN_NEXT_OUTPUT_DIR: outputDir },
    encoding: "utf-8",
    stdio: "pipe",
  });
}

describe("populate-static-cache", () => {
  it("copies the OpenNext cache into the assets dir the static-assets cache reads", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "open-next-"));
    mkdirSync(join(outputDir, "cache", "BUILD_ID", "teams"), { recursive: true });
    writeFileSync(join(outputDir, "cache", "BUILD_ID", "index.cache"), "{}");
    writeFileSync(join(outputDir, "cache", "BUILD_ID", "teams", "mariners.cache"), "{}");

    run(outputDir);
    run(outputDir); // idempotent — wrangler may run the build command twice

    const target = join(outputDir, "assets", "cdn-cgi", "_next_cache", "BUILD_ID");
    expect(readFileSync(join(target, "index.cache"), "utf-8")).toBe("{}");
    expect(existsSync(join(target, "teams", "mariners.cache"))).toBe(true);
  });

  it("fails loudly when there is no OpenNext build to copy from", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "open-next-"));
    expect(() => run(outputDir)).toThrow();
  });
});
