import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";

const JWT_SECRET = process.env.JWT_SECRET || "ragu-dev-secret-change-me";

// Simple JWT: base64url(header).base64url(payload).signature
function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64url(String.fromCharCode(...new Uint8Array(sig)));
}

export async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = await hmacSign(`${header}.${body}`, JWT_SECRET);
  return `${header}.${body}.${sig}`;
}

export async function verifyJwt(token: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expectedSig = await hmacSign(`${header}.${body}`, JWT_SECRET);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(base64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const token = getCookie(c, "ragu_session");
    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const payload = await verifyJwt(token);
    if (!payload || payload.sub !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };
}
