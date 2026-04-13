// HMAC-signed unsubscribe tokens so that arbitrary user IDs can't be used
// to unsubscribe other users. Uses Web Crypto API (available in Cloudflare Workers
// and Next.js edge runtime).
//
// Token format: "{userId}.{hex-encoded HMAC-SHA256 signature}"
// Secret env var: UNSUBSCRIBE_SECRET (falls back to CRON_SECRET for convenience)

const ALGORITHM = { name: "HMAC", hash: "SHA-256" };

async function getKey() {
  const secret =
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.CRON_SECRET ||
    "dev-fallback-not-for-production";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    ALGORITHM,
    false,
    ["sign", "verify"]
  );
}

export async function signToken(userId) {
  const key = await getKey();
  const sig = await crypto.subtle.sign(
    ALGORITHM,
    key,
    new TextEncoder().encode(userId)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${userId}.${hex}`;
}

export async function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  if (!userId || !provided) return null;

  const expected = await signToken(userId);
  const expectedSig = expected.slice(dot + 1);

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expectedSig.length) return null;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return diff === 0 ? userId : null;
}
