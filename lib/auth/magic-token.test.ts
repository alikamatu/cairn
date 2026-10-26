import { describe, expect, it } from "vitest";
import { signMagicToken, verifyMagicToken } from "./magic-token";

describe("magic tokens", () => {
  it("round-trips a valid token", () => {
    const token = signMagicToken("User@Example.com", "signin");
    const result = verifyMagicToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.email).toBe("user@example.com");
      expect(result.mode).toBe("signin");
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    }
  });

  it("rejects a tampered token", () => {
    const token = signMagicToken("a@b.com", "signup");
    const [body] = token.split(".");
    const result = verifyMagicToken(`${body}.deadbeef`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad-signature");
  });

  it("rejects malformed input", () => {
    expect(verifyMagicToken("not-a-token").ok).toBe(false);
  });
});
