import { NextResponse, type NextRequest } from "next/server";
import { verifyMagicToken } from "@/lib/auth/magic-token";
import { getSession, setSessionCookie } from "@/lib/auth/session";
import { findOrCreateUserByEmail } from "@/lib/db/users";

export async function GET(req: NextRequest) {
  const base = process.env.APP_URL ?? req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/signin?error=invalid", base));
  }

  const result = verifyMagicToken(token);
  if (!result.ok) {
    const reason = result.reason === "expired" ? "expired" : "invalid";
    return NextResponse.redirect(new URL(`/signin?error=${reason}`, base));
  }

  const existing = await getSession();
  const carry = existing && existing.email === result.email ? existing : null;
  const user = await findOrCreateUserByEmail(result.email, {
    name: carry?.name,
    avatarId: carry?.avatarId,
    avatarUrl: carry?.avatarUrl,
    timezone: carry?.timezone,
    theme: carry?.theme,
    startOfWeek: carry?.startOfWeek,
    onboarded: carry?.onboarded ?? false,
    plan: carry?.plan,
    planInterval: carry?.planInterval ?? null,
    planRenewsAt: carry?.planRenewsAt ?? null,
    paystackCustomerCode: carry?.paystackCustomerCode ?? null,
    emailDigest: carry?.emailDigest ?? "weekly",
  });

  await setSessionCookie({
    email: user.email,
    name: user.profile.name,
    avatarId: user.profile.avatarId,
    avatarUrl: user.profile.avatarUrl,
    timezone: user.profile.timezone,
    theme: user.profile.theme,
    startOfWeek: user.profile.startOfWeek,
    onboarded: user.profile.onboarded ?? false,
    plan: user.profile.plan,
    planInterval: user.profile.planInterval ?? null,
    planRenewsAt: user.profile.planRenewsAt ?? null,
    paystackCustomerCode: user.profile.paystackCustomerCode ?? null,
    emailDigest: user.profile.emailDigest,
  });

  const onboarded = user.profile.onboarded ?? false;
  return NextResponse.redirect(new URL(onboarded ? "/today" : "/onboarding", base));
}
