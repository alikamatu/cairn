import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "cairn_session";

// Edge runtime can't import node:crypto for verification; we only check presence.
// Full verification happens in server components/actions on each request.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE)?.value);

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
