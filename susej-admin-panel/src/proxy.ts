import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const publicRoutes = ["/login", "/login/2fa", "/forgot-password", "/reset-password"];

const roleRoutes: Record<string, string[]> = {
  super_admin: ["/dashboard"],
  manager: ["/dashboard"],
  moderator: ["/dashboard/communities"],
};

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token && verifySessionToken(token)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? verifySessionToken(token) : null;

    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const allowed = roleRoutes[session.role];
    if (allowed && !allowed.some((route) => pathname.startsWith(route))) {
      const fallback = allowed[0];
      const url = fallback === "/dashboard" ? new URL("/dashboard", request.url) : new URL(`${fallback}?error=role`, request.url);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};