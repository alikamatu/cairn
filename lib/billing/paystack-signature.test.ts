import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./paystack";

describe("verifyWebhookSignature", () => {
  it("accepts a valid HMAC-SHA512 signature", () => {
    const body = JSON.stringify({ event: "charge.success" });
    const sig = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig)).toBe(true);
  });

  it("rejects a bad signature", () => {
    expect(verifyWebhookSignature("{}", "00".repeat(64))).toBe(false);
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });
});
