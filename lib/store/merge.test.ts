import { describe, expect, it } from "vitest";
import { mergeById, mergePersistedState } from "./merge";
import { emptyPersistedState } from "./persist";

describe("mergeById", () => {
  it("keeps unique ids from both sides", () => {
    const merged = mergeById(
      [{ id: "a", createdAt: "2020-01-01T00:00:00.000Z" }],
      [{ id: "b", createdAt: "2020-01-02T00:00:00.000Z" }],
    );
    expect(merged.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("prefers the newer stamp on conflict", () => {
    const merged = mergeById(
      [{ id: "a", title: "local", updatedAt: "2024-06-02T00:00:00.000Z" }],
      [{ id: "a", title: "remote", updatedAt: "2024-06-01T00:00:00.000Z" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe("local");
  });

  it("prefers remote on equal stamps", () => {
    const stamp = "2024-06-01T00:00:00.000Z";
    const merged = mergeById(
      [{ id: "a", title: "local", createdAt: stamp }],
      [{ id: "a", title: "remote", createdAt: stamp }],
    );
    expect(merged[0]?.title).toBe("remote");
  });
});

describe("mergePersistedState", () => {
  it("merges each collection independently", () => {
    const local = {
      ...emptyPersistedState,
      tasks: [{ id: "t1", title: "L", status: "open" as const, priority: "med" as const, labels: [], order: 0, createdAt: "2024-01-02T00:00:00.000Z" }],
    };
    const remote = {
      ...emptyPersistedState,
      tasks: [{ id: "t1", title: "R", status: "open" as const, priority: "med" as const, labels: [], order: 0, createdAt: "2024-01-01T00:00:00.000Z" }],
      notes: [{
        id: "n1", title: "N", body: "", tags: [], taskIds: [], goalIds: [], pinned: false,
        createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z",
      }],
    };
    const merged = mergePersistedState(local, remote);
    expect(merged.tasks[0]?.title).toBe("L");
    expect(merged.notes).toHaveLength(1);
  });
});
