import "server-only";
import type { Session } from "@/lib/auth/session";
import { requirePro } from "@/lib/billing/require-pro";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Shared gate for /api/ai/* — Pro (in production) + per-user rate limit.
 */
export async function guardAiRoute(): Promise<
  { ok: true; session: Session } | { ok: false; response: Response }
> {
  const gate = await requirePro();
  if (!gate.ok) return gate;

  const limited = await rateLimit(`ai:${gate.session.email}`, 60, 60_000);
  if (!limited.allowed) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "rate_limited", retryAfterSec: limited.retryAfterSec }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(limited.retryAfterSec),
          },
        },
      ),
    };
  }

  return gate;
}
