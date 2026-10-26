import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { buildReference, initTransaction } from "@/lib/billing/paystack";
import { CURRENCY, intervalAmountMinor } from "@/lib/billing/plans";
import { rateLimit } from "@/lib/rate-limit";

const InputSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = await rateLimit(`checkout:${session.email}`, 10, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const json = await req.json().catch(() => ({}));
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "invalid" }, { status: 400 });
  }
  const { interval } = parsed.data;

  const origin =
    process.env.APP_URL ??
    req.headers.get("origin") ??
    `https://${req.headers.get("host") ?? "localhost:3000"}`;

  const reference = buildReference(session.email);
  const callbackUrl = `${origin}/api/billing/callback`;

  try {
    const { data } = await initTransaction({
      email: session.email,
      amountMinor: intervalAmountMinor(interval),
      currency: CURRENCY,
      reference,
      callbackUrl,
      metadata: {
        userEmail: session.email,
        plan: "pro",
        interval,
        cancel_action: `${origin}/settings/billing?status=cancelled`,
      },
    });
    return NextResponse.json({ authorizationUrl: data.authorization_url, reference: data.reference });
  } catch (err) {
    const message = err instanceof Error ? err.message : "checkout_failed";
    console.error("[billing/checkout]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
