import { describe, expect, it } from "vitest";
import { buildActivatedPatch, readSubscription } from "./subscription";
import type { Session } from "@/lib/auth/session";

function session(partial: Partial<Session>): Session {
  return {
    email: "a@b.com",
    iat: Date.now(),
    exp: Date.now() + 86_400_000,
    ...partial,
  };
}

describe("readSubscription", () => {
  it("treats missing plan as free", () => {
    expect(readSubscription(session({})).tier).toBe("free");
    expect(readSubscription(null).active).toBe(false);
  });

  it("returns pro when plan is active", () => {
    const view = readSubscription(session({
      plan: "pro",
      planInterval: "monthly",
      planRenewsAt: Date.now() + 86_400_000,
    }));
    expect(view.tier).toBe("pro");
    expect(view.active).toBe(true);
  });

  it("expires pro past renewsAt", () => {
    const view = readSubscription(session({
      plan: "pro",
      planRenewsAt: Date.now() - 1000,
    }));
    expect(view.tier).toBe("free");
    expect(view.active).toBe(false);
  });
});

describe("buildActivatedPatch", () => {
  it("sets pro fields and a future renewsAt", () => {
    const patch = buildActivatedPatch("yearly", "CUS_x");
    expect(patch.plan).toBe("pro");
    expect(patch.planInterval).toBe("yearly");
    expect(patch.paystackCustomerCode).toBe("CUS_x");
    expect(patch.planRenewsAt).toBeGreaterThan(Date.now());
  });
});
