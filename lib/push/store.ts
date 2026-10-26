import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db/mongo";

/**
 * Push subscription storage — Mongo first, file-backed JSON fallback
 * (`.data/push-subs.json`) for local/dev when Mongo is unavailable.
 */

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "push-subs.json");

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
};

export type StoredSub = {
  email: string;
  /** Optional client-attached metadata (timezone, habit reminder times, etc.). */
  meta?: {
    timezone?: string;
    /** Map of "HH:MM" => habit titles — when to fire which reminders. */
    habitsByTime?: Record<string, string[]>;
  };
  subscription: PushSubscriptionJSON;
  createdAt: string;
  /** Stable hash of endpoint, used as the record key. */
  id: string;
};

type DB = { subs: StoredSub[] };

function hash(endpoint: string): string {
  let h = 5381;
  for (let i = 0; i < endpoint.length; i++) h = ((h << 5) + h + endpoint.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function readFile(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw) as DB;
  } catch {
    return { subs: [] };
  }
}

async function writeFile(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

export async function upsertSub(
  email: string,
  sub: PushSubscriptionJSON,
  meta?: StoredSub["meta"],
): Promise<StoredSub> {
  const id = hash(sub.endpoint);
  const next: StoredSub = {
    id,
    email: email.toLowerCase(),
    subscription: sub,
    meta,
    createdAt: new Date().toISOString(),
  };

  try {
    const db = await getDb();
    const col = db.collection<StoredSub>("pushSubscriptions");
    const existing = await col.findOne({ id });
    const doc = existing
      ? { ...existing, ...next, createdAt: existing.createdAt }
      : next;
    await col.updateOne({ id }, { $set: doc }, { upsert: true });
    return doc;
  } catch {
    const db = await readFile();
    const idx = db.subs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      db.subs[idx] = { ...db.subs[idx], ...next, createdAt: db.subs[idx].createdAt };
    } else {
      db.subs.push(next);
    }
    await writeFile(db);
    return next;
  }
}

export async function removeSubByEndpoint(endpoint: string): Promise<void> {
  const id = hash(endpoint);
  try {
    const db = await getDb();
    await db.collection("pushSubscriptions").deleteOne({ id });
  } catch {
    const file = await readFile();
    file.subs = file.subs.filter((s) => s.id !== id);
    await writeFile(file);
  }
}

export async function listSubsForEmail(email: string): Promise<StoredSub[]> {
  const normalized = email.toLowerCase();
  try {
    const db = await getDb();
    return await db.collection<StoredSub>("pushSubscriptions").find({ email: normalized }).toArray();
  } catch {
    const file = await readFile();
    return file.subs.filter((s) => s.email === normalized);
  }
}

export async function listAllSubs(): Promise<StoredSub[]> {
  try {
    const db = await getDb();
    return await db.collection<StoredSub>("pushSubscriptions").find({}).toArray();
  } catch {
    return (await readFile()).subs;
  }
}
