import type { PersistedState } from "./persist";

type WithId = { id: string };

function entityStamp(item: Record<string, unknown>): number {
  const candidates = [
    item.updatedAt,
    item.deletedAt,
    item.completedAt,
    item.createdAt,
  ];
  let best = 0;
  for (const c of candidates) {
    if (typeof c !== "string" || !c) continue;
    const t = Date.parse(c);
    if (!Number.isNaN(t) && t > best) best = t;
  }
  return best;
}

/**
 * Merge two entity arrays by `id`. When both sides have the same id, keep the
 * one with the later activity stamp (updatedAt / deletedAt / completedAt / createdAt).
 * Ties prefer `preferred` (typically the server copy).
 */
export function mergeById<T extends WithId>(
  local: T[],
  remote: T[],
  prefer: "local" | "remote" = "remote",
): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const localT = entityStamp(item as unknown as Record<string, unknown>);
    const remoteT = entityStamp(existing as unknown as Record<string, unknown>);
    if (localT > remoteT) map.set(item.id, item);
    else if (localT < remoteT) map.set(item.id, existing);
    else map.set(item.id, prefer === "local" ? item : existing);
  }
  return Array.from(map.values());
}

/** Entity-level merge of two persisted snapshots. Reduces multi-tab / multi-device loss. */
export function mergePersistedState(
  local: PersistedState,
  remote: PersistedState,
): PersistedState {
  return {
    tasks: mergeById(local.tasks, remote.tasks),
    habits: mergeById(local.habits, remote.habits),
    goals: mergeById(local.goals, remote.goals),
    projects: mergeById(local.projects, remote.projects),
    notes: mergeById(local.notes, remote.notes),
    reviews: mergeById(local.reviews, remote.reviews),
    conversations: mergeById(local.conversations, remote.conversations),
  };
}
