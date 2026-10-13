// Minimal APNs client: ES256 provider token (JWT) signed with the team's .p8 key, HTTP/2 POST per device.
// Cloudflare's fetch negotiates HTTP/2 with api.push.apple.com; if Apple ever rejects the connection the
// error is logged and the purchase itself is unaffected (push is best-effort).
import { Env } from "./env";

let jwtCache: { token: string; iat: number } | null = null;

function b64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function providerToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (jwtCache && now - jwtCache.iat < 50 * 60) return jwtCache.token;
  const header = b64url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const claims = b64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: now }));
  const key = await importKey(env.APNS_KEY!);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${header}.${claims}`));
  // WebCrypto returns raw r||s (64 bytes), which is exactly what JWS ES256 wants.
  const token = `${header}.${claims}.${b64url(sig)}`;
  jwtCache = { token, iat: now };
  return token;
}

export interface Push { title: string; body: string; data?: Record<string, unknown> }

export async function send(env: Env, deviceToken: string, push: Push): Promise<{ ok: boolean; status: number; reason?: string }> {
  if (!env.APNS_KEY) return { ok: false, status: 0, reason: "APNS_KEY not configured" };
  const host = env.APNS_ENV === "production" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await providerToken(env)}`,
      "apns-topic": env.APNS_TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({ aps: { alert: { title: push.title, body: push.body }, sound: "default" }, ...(push.data ?? {}) }),
  });
  const text = await res.text();
  let reason: string | undefined;
  try { reason = JSON.parse(text).reason; } catch { reason = text || undefined; }
  return { ok: res.ok, status: res.status, reason };
}

export async function notifyUser(env: Env, userId: string, push: Push): Promise<{ status: number; reason?: string }[]> {
  const rows = (await env.DB.prepare("SELECT token FROM devices WHERE user_id = ?").bind(userId).all<{ token: string }>()).results;
  const results: { status: number; reason?: string }[] = [];
  for (const r of rows) {
    let out: { ok: boolean; status: number; reason?: string };
    try { out = await send(env, r.token, push); } catch (e) { out = { ok: false, status: -1, reason: String(e) }; }
    console.log("apns", userId, out.status, out.reason ?? "");
    results.push({ status: out.status, reason: out.reason });
    if (out.status === 410 || out.reason === "BadDeviceToken" || out.reason === "Unregistered") {
      await env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(r.token).run();
    }
  }
  return results;
}
