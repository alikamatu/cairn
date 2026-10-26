import { describe, expect, it } from "vitest";
import { UserStateSchema } from "./schemas";
import { emptyPersistedState } from "./persist";

describe("UserStateSchema", () => {
  it("accepts an empty snapshot", () => {
    const parsed = UserStateSchema.safeParse(emptyPersistedState);
    expect(parsed.success).toBe(true);
  });

  it("rejects oversized or invalid entities", () => {
    const bad = {
      ...emptyPersistedState,
      tasks: [{ id: "t1", title: "", status: "open", priority: "med", labels: [], order: 0, createdAt: "x" }],
    };
    expect(UserStateSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a well-formed task", () => {
    const ok = {
      ...emptyPersistedState,
      tasks: [{
        id: "t1",
        title: "Ship",
        status: "open",
        priority: "high",
        labels: ["work"],
        order: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
      }],
    };
    expect(UserStateSchema.safeParse(ok).success).toBe(true);
  });
});
