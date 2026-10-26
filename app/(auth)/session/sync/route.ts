import { NextResponse, type NextRequest } from "next/server";
import { getSession, setSessionCookie } from "@/lib/auth/session";
import { getUserByEmail } from "@/lib/db/users";

/**
 * Refresh the session cookie from the DB profile, then redirect.
 * Cookie writes are only allowed in Route Handlers / Server Actions.
 */
export async function GET(req: NextRequest) {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/today";
  const nextPath = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/today";

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/signin", base));
  }

  const user = await getUserByEmail(session.email);
  if (!user) {
    return NextResponse.redirect(new URL(nextPath, base));
  }

  const p = user.profile;
  await setSessionCookie({
    email: user.email,
    name: p.name ?? session.name,
    avatarId: p.avatarId ?? session.avatarId,
    avatarUrl: p.avatarUrl ?? session.avatarUrl,
    timezone: p.timezone ?? session.timezone,
    theme: p.theme ?? session.theme,
    startOfWeek: p.startOfWeek ?? session.startOfWeek,
    onboarded: p.onboarded ?? false,
    plan: p.plan ?? session.plan,
    planInterval: p.planInterval ?? session.planInterval ?? null,
    planRenewsAt: p.planRenewsAt ?? session.planRenewsAt ?? null,
    paystackCustomerCode: p.paystackCustomerCode ?? session.paystackCustomerCode ?? null,
    emailDigest: p.emailDigest ?? session.emailDigest,
  });

  const destination = p.onboarded ? nextPath : "/onboarding";
  return NextResponse.redirect(new URL(destination, base));
}
