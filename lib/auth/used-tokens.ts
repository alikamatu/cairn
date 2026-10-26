import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db/mongo";

function tokenId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mark a magic-link (or similar) token as consumed.
 * Returns true the first time; false if already used.
 * When Mongo is unavailable, fails open (allows the token) so sign-in still works.
 */
export async function consumeMagicToken(token: string, expiresAtMs: number): Promise<boolean> {
  const id = tokenId(token);
  const now = new Date();
  const expiresAt = new Date(expiresAtMs);

  try {
    const db = await getDb();
    const col = db.collection<{ _id: string; usedAt: Date; expiresAt: Date }>("usedTokens");
    try {
      await col.insertOne({ _id: id, usedAt: now, expiresAt });
      return true;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 11000) return false; // duplicate key
      throw err;
    }
  } catch (err) {
    console.warn("[auth] usedTokens unavailable, allowing token:", (err as Error).message);
    return true;
  }
}
