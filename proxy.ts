import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "cairn_session";
const LEGACY_COOKIE = "osama_session";

// Edge runtime can't import node:crypto for verification; we only check presence.
// Full verification happens in server components/actions on each request.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const current = req.cookies.get(COOKIE)?.value;
  const legacy = req.cookies.get(LEGACY_COOKIE)?.value;
  const hasSession = Boolean(current || legacy);

  // Migrate pre-rebrand cookie onto the Cairn name when present.
  if (legacy && !current) {
    const res = NextResponse.next();
    res.cookies.set(COOKIE, legacy, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    res.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
    // Still apply auth redirects below using hasSession.
    const redirect = authRedirect(req, hasSession, pathname);
    if (redirect) {
      redirect.cookies.set(COOKIE, legacy, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
      redirect.cookies.set(LEGACY_COOKIE, "", { path: "/", maxAge: 0 });
      return redirect;
    }
    return res;
  }

  return authRedirect(req, hasSession, pathname) ?? NextResponse.next();
}

function authRedirect(req: NextRequest, hasSession: boolean, pathname: string) {
  const isAuthPage =
    pathname === "/signin" ||
    pathname === "/verify" ||
    pathname === "/verify-request";

  const isAppPage =
    pathname.startsWith("/today") ||
    pathname.startsWith("/inbox") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/habits") ||
    pathname.startsWith("/goals") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/notes") ||
    pathname.startsWith("/stats") ||
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/trash") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/admin");

  if (isAppPage && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession && pathname !== "/verify") {
    const url = req.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  return null;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
