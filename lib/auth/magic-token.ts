import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET is not set");

const TTL_MS = 15 * 60 * 1000;

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signMagicToken(email: string, mode: "signin" | "signup"): string {
  const payload = { e: email.toLowerCase(), m: mode, x: Date.now() + TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", SECRET!).update(body).digest());
  return `${body}.${sig}`;
}

export type VerifyResult =
  | { ok: true; email: string; mode: "signin" | "signup"; expiresAt: number }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export function verifyMagicToken(token: string): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;

  const expected = createHmac("sha256", SECRET!).update(body).digest();
  const actual = fromB64url(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as {
      e: string; m: "signin" | "signup"; x: number;
    };
    if (Date.now() > payload.x) return { ok: false, reason: "expired" };
    return { ok: true, email: payload.e, mode: payload.m, expiresAt: payload.x };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

export const MAGIC_TOKEN_TTL_MINUTES = 15;
