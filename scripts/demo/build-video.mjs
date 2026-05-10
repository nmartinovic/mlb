// scripts/demo/build-video.mjs
// Stitches the captured frames into demo.mp4 and demo.gif with on-screen
// captions and crossfade transitions. ~58s total runtime, sized for Twitter
// and Reddit. See issue #127.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const framesDir = path.join(__dirname, "out", "frames");
const outDir = path.join(__dirname, "out");
const tmpDir = path.join(outDir, "tmp");
fs.mkdirSync(tmpDir, { recursive: true });

const W = 1280;
const H = 800;
const FPS = 30;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
// Brand palette
const BG_DARK = "0x0f1311";
const BG_PAPER = "0xf7f5ef";
const INK = "0xf7f5ef";
const ACCENT = "0xb8312f";

// Caption text + duration + which background to letterbox into.
// `bg: "paper"` is used for the email scene since the email card sits on a
// beige background; everything else uses the dark site background.
const scenes = [
  { file: "01-landing.png",          dur: 5.5, bg: "dark",  caption: "Spoiler-free MLB recaps in your inbox." },
  { file: "02-login-empty.png",      dur: 2.5, bg: "dark",  caption: "1. Sign up with your email." },
  { file: "03-login-typed.png",      dur: 3.0, bg: "dark",  caption: "No password — just a magic link." },
  { file: "04-login-sent.png",       dur: 4.0, bg: "dark",  caption: "Check your inbox to confirm." },
  { file: "05-dashboard-empty.png",  dur: 3.0, bg: "dark",  caption: "2. Pick your teams." },
  { file: "06-dashboard-one.png",    dur: 3.5, bg: "dark",  caption: "Follow one team..." },
  { file: "07-dashboard-three.png",  dur: 4.5, bg: "dark",  caption: "...or all 30." },
  { file: "08-email.png",            dur: 8.5, bg: "paper", caption: "3. Wake up to a recap. No score in sight." },
];

const XFADE = 0.4; // seconds of crossfade between scenes
const TOTAL = scenes.reduce((a, s) => a + s.dur, 0) - XFADE * (scenes.length - 1);
console.log(`Target duration: ${TOTAL.toFixed(1)}s`);

// Escape text for ffmpeg drawtext (single quotes + colons + special chars).
function esc(t) {
  return t.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

// Build a per-scene segment: scale-pad to 1280x800 with the right background,
// then overlay the caption near the bottom in a translucent pill.
function buildSegment(scene, idx) {
  const inFile = path.join(framesDir, scene.file);
  const outFile = path.join(tmpDir, `seg-${String(idx).padStart(2, "0")}.mp4`);
  const bg = scene.bg === "paper" ? BG_PAPER : BG_DARK;
  const captionInk = scene.bg === "paper" ? "0x1a1d1c" : "0xf7f5ef";
  const captionBox = scene.bg === "paper" ? "0xffffff@0.85" : "0x000000@0.55";
  const filter = [
    `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${bg}`,
    `setsar=1`,
    `drawtext=fontfile=${FONT_BOLD}:text='${esc(scene.caption)}':fontcolor=${captionInk}:fontsize=30:x=(w-text_w)/2:y=h-110:box=1:boxcolor=${captionBox}:boxborderw=22`,
  ].join(",");
  execSync(
    `ffmpeg -y -loop 1 -t ${scene.dur} -i "${inFile}" -vf "${filter}" -r ${FPS} -c:v libx264 -preset medium -pix_fmt yuv420p "${outFile}"`,
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  return outFile;
}

console.log("Encoding per-scene segments...");
const segs = scenes.map((s, i) => {
  process.stdout.write(`  ${i + 1}/${scenes.length} ${s.file} ... `);
  const out = buildSegment(s, i);
  console.log("ok");
  return out;
});

// Concat with xfade crossfades. Build the filtergraph dynamically.
console.log("Crossfading + final encode (MP4)...");
const inputs = segs.map((f) => `-i "${f}"`).join(" ");
const parts = [];
let prev = "[0:v]";
let acc = scenes[0].dur;
for (let i = 1; i < segs.length; i++) {
  const offset = acc - XFADE;
  const out = `[v${i}]`;
  parts.push(`${prev}[${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset}${out}`);
  prev = out;
  acc += scenes[i].dur - XFADE;
}
const filtergraph = parts.join(";");
const mapLabel = parts.length === 0 ? "[0:v]" : `[v${segs.length - 1}]`;
const mp4Out = path.join(outDir, "demo.mp4");
execSync(
  `ffmpeg -y ${inputs} -filter_complex "${filtergraph}" -map "${mapLabel}" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart "${mp4Out}"`,
  { stdio: ["ignore", "ignore", "inherit"] },
);

// GIF: smaller, palette-optimized, 12fps, scaled to 800w. Two-pass for quality.
console.log("Encoding GIF (palette pass)...");
const palette = path.join(tmpDir, "palette.png");
execSync(
  `ffmpeg -y -i "${mp4Out}" -vf "fps=12,scale=800:-1:flags=lanczos,palettegen=stats_mode=full" "${palette}"`,
  { stdio: ["ignore", "ignore", "inherit"] },
);
const gifOut = path.join(outDir, "demo.gif");
execSync(
  `ffmpeg -y -i "${mp4Out}" -i "${palette}" -filter_complex "fps=12,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4" "${gifOut}"`,
  { stdio: ["ignore", "ignore", "inherit"] },
);

const mp4Size = (fs.statSync(mp4Out).size / 1024 / 1024).toFixed(2);
const gifSize = (fs.statSync(gifOut).size / 1024 / 1024).toFixed(2);
console.log("");
console.log(`✓ ${path.relative(process.cwd(), mp4Out)}  ${mp4Size} MB`);
console.log(`✓ ${path.relative(process.cwd(), gifOut)}  ${gifSize} MB`);
