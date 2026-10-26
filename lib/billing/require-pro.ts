import "server-only";
import { getSession, updateSession, type Session } from "@/lib/auth/session";
import { getUserByEmail } from "@/lib/db/users";
import { readSubscription } from "./subscription";

export type ProGate =
  | { ok: true; session: Session }
  | { ok: false; response: Response };

/**
 * Require an authenticated Pro subscriber. Prefers Mongo profile over the
 * session cookie so Paystack webhook renewals apply without a re-login.
 *
 * In non-production, Pro is not required unless `AI_REQUIRE_PRO=1` so local
 * development keeps working without a Paystack checkout.
 */
export async function requirePro(): Promise<ProGate> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: new Response("unauthorized", { status: 401 }) };
  }

  if (process.env.NODE_ENV !== "production" && process.env.AI_REQUIRE_PRO !== "1") {
    return { ok: true, session };
  }

  let effective: Session = session;
  try {
    const user = await getUserByEmail(session.email);
    if (user?.profile) {
      const profilePlan = user.profile.plan ?? "free";
      const profileRenews = user.profile.planRenewsAt ?? null;
      const cookieStale =
        profilePlan !== session.plan ||
        profileRenews !== (session.planRenewsAt ?? null) ||
        (user.profile.planInterval ?? null) !== (session.planInterval ?? null);

      if (cookieStale) {
        await updateSession({
          plan: profilePlan,
          planInterval: user.profile.planInterval ?? null,
          planRenewsAt: profileRenews,
          paystackCustomerCode: user.profile.paystackCustomerCode ?? null,
        });
        effective = {
          ...session,
          plan: profilePlan,
          planInterval: user.profile.planInterval ?? null,
          planRenewsAt: profileRenews,
          paystackCustomerCode: user.profile.paystackCustomerCode ?? null,
        };
      }
    }
  } catch {
    /* cookie-only fallback */
  }

  const sub = readSubscription(effective);
  if (!sub.active || sub.tier !== "pro") {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          error: "pro_required",
          message: "Upgrade to Pro to use AI features.",
        }),
        {
          status: 402,
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  return { ok: true, session: effective };
}
