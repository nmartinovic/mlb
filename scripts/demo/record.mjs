// scripts/demo/record.mjs
// Captures still frames for the 60-second product demo (issue #127).
// Requires: chromium (system) + puppeteer-core (devDep) + a running dev server
// on http://localhost:3000 with the /demo-dashboard and /api/demo-email routes
// present (these are temporary scaffolding the build script removes).

import puppeteer from "puppeteer";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "out", "frames");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 2 };
const BASE = "http://localhost:3000";

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--hide-scrollbars"],
  headless: "new",
});

async function shoot(name, fn) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  // Wait until network is idle so Tailwind/JS finish
  await fn(page);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("  →", path.relative(process.cwd(), file));
  await page.close();
}

console.log("Capturing scenes...");

// Scene 1: landing hero
await shoot("01-landing", async (page) => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 400));
});

// Scene 2: login form (signup variant)
await shoot("02-login-empty", async (page) => {
  await page.goto(`${BASE}/login?next=signup`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
});

// Scene 3: login form with email typed
await shoot("03-login-typed", async (page) => {
  await page.goto(`${BASE}/login?next=signup`, { waitUntil: "networkidle0" });
  await page.click('input[type="email"]');
  await page.type('input[type="email"]', "fan@example.com", { delay: 0 });
  await new Promise((r) => setTimeout(r, 200));
});

// Scene 4: magic-link sent confirmation
// We force the React `sent` state by directly calling the form's submit
// handler effect: easier to just patch the DOM into the success state.
await shoot("04-login-sent", async (page) => {
  await page.goto(`${BASE}/login?next=signup`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const card = document.querySelector("main > div");
    if (!card) return;
    card.innerHTML = `
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#3f6e57] bg-[#0f2a1f]/80 text-xl">✉</div>
        <h1 class="mt-5 text-2xl font-bold tracking-tight text-[#f7f5ef]">Check your email</h1>
        <p class="mt-3 text-sm text-[#a8a299]">We sent a magic link to <span class="text-[#f7f5ef]">fan@example.com</span>. Click it to sign in.</p>
        <p class="mt-4 text-xs text-[#a8a299]/80">It usually arrives within a minute. If you don't see it, check your spam folder &mdash; the email is from <span class="text-[#a8a299]">highlights@ninthinning.email</span>.</p>
      </div>`;
  });
  await new Promise((r) => setTimeout(r, 200));
});

// Scene 5: empty dashboard
await shoot("05-dashboard-empty", async (page) => {
  await page.goto(`${BASE}/demo-dashboard`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
});

// Scene 6: dashboard with Dodgers selected
await shoot("06-dashboard-one", async (page) => {
  await page.goto(`${BASE}/demo-dashboard?followed=119`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
});

// Scene 7: dashboard with three teams selected
await shoot("07-dashboard-three", async (page) => {
  await page.goto(`${BASE}/demo-dashboard?followed=119,147,111`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
});

// Scene 8: rendered recap email (standalone HTML).
// Use a viewport slightly wider than the email's 520px max-width so the card
// fills the frame instead of floating in a sea of beige. Then we letterbox
// to 16:9 in ffmpeg to match the other scenes.
await shoot("08-email", async (page) => {
  await page.setViewport({ width: 600, height: 800, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/api/demo-email`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
});

await browser.close();
console.log("Done.");
