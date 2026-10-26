import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET is not set");

const COOKIE_NAME = "cairn_session";
/** Pre-rebrand cookie — still accepted and migrated on read. */
const LEGACY_COOKIE_NAME = "osama_session";
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

export type PlanInterval = "monthly" | "yearly";
export type PlanTier = "free" | "pro";

export type Session = {
  email: string;
  name?: string;
  avatarId?: string;
  avatarUrl?: string;
  timezone?: string;
  theme?: string;
  startOfWeek?: "sun" | "mon";
  onboarded?: boolean;
  /** billing — cookie-stored MVP. Move to DB when entity layer lands. */
  plan?: PlanTier;
  planInterval?: PlanInterval | null;
  planRenewsAt?: number | null;
  paystackCustomerCode?: string | null;
  /** transactional email opt-outs */
  emailDigest?: "off" | "daily" | "weekly";
  iat: number;
  exp: number;
};

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64")
    .replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signSession(data: Omit<Session, "iat" | "exp">): string {
  const now = Date.now();
  const payload: Session = { ...data, iat: now, exp: now + TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", SECRET!).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): Session | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET!).update(body).digest();
  const actual = fromB64url(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as Session;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: Omit<Session, "iat" | "exp">) {
  const token = signSession(session);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(TTL_MS / 1000),
  });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  const legacy = jar.get(LEGACY_COOKIE_NAME)?.value;

  if (!raw && legacy) {
    const session = verifySessionToken(legacy);
    if (!session) return null;
    // Migrate when the cookie store is writable (route handlers / actions).
    try {
      jar.set(COOKIE_NAME, legacy, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: Math.max(0, Math.floor((session.exp - Date.now()) / 1000)),
      });
      jar.set(LEGACY_COOKIE_NAME, "", { path: "/", maxAge: 0 });
    } catch {
      /* read-only Server Component context */
    }
    return session;
  }

  if (!raw) return null;
  return verifySessionToken(raw);
}

export async function updateSession(patch: Partial<Omit<Session, "iat" | "exp">>) {
  const current = await getSession();
  if (!current) return null;
  const { iat: _i, exp: _e, ...rest } = current;
  void _i; void _e;
  const next = { ...rest, ...patch };
  await setSessionCookie(next);
  return next;
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
