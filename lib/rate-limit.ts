import "server-only";
import { getDb } from "@/lib/db/mongo";

type Hit = { count: number; windowStart: number };

const memory = new Map<string, Hit>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Sliding fixed-window rate limiter. Prefers Mongo so it works across
 * serverless instances; falls back to process memory when DB is down.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const db = await getDb();
    const col = db.collection<{ _id: string; count: number; windowStart: number }>("rateLimits");
    const doc = await col.findOne({ _id: key });

    if (!doc || now - doc.windowStart >= windowMs) {
      await col.updateOne(
        { _id: key },
        { $set: { count: 1, windowStart: now } },
        { upsert: true },
      );
      return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
    }

    if (doc.count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((doc.windowStart + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSec };
    }

    await col.updateOne({ _id: key }, { $inc: { count: 1 } });
    return {
      allowed: true,
      remaining: Math.max(0, limit - doc.count - 1),
      retryAfterSec: Math.ceil((doc.windowStart + windowMs - now) / 1000),
    };
  } catch {
    return memoryRateLimit(key, limit, windowMs, now);
  }
}

function memoryRateLimit(key: string, limit: number, windowMs: number, now: number): RateLimitResult {
  const hit = memory.get(key);
  if (!hit || now - hit.windowStart >= windowMs) {
    memory.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (hit.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((hit.windowStart + windowMs - now) / 1000)),
    };
  }
  hit.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - hit.count),
    retryAfterSec: Math.ceil((hit.windowStart + windowMs - now) / 1000),
  };
}

/** Clear in-memory buckets (tests only). */
export function __resetMemoryRateLimits() {
  memory.clear();
}
