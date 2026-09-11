import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const publicRoutes = ["/login", "/login/2fa", "/forgot-password", "/reset-password"];

// RBAC matrix — must mirror the permission UI in dashboard/admins.
// super_admin: full access, manager: everything except admin user management,
// moderator: community/review/report/message moderation only.
const roleRoutes: Record<string, string[]> = {
  super_admin: ["/dashboard"],
  manager: ["/dashboard"],
  moderator: [
    "/dashboard/communities",
    "/dashboard/reviews",
    "/dashboard/reports",
    "/dashboard/messages",
    "/dashboard/posts",
    "/dashboard/hashtags",
    "/dashboard/support",
  ],
};

// Enforcement helper: manager cannot manage admins; moderator cannot touch commerce/finance.
const managerBlockedPrefixes = ["/dashboard/admins", "/dashboard/system", "/dashboard/audit-logs"];
const moderatorAllowedPrefixes = [
  "/dashboard/communities",
  "/dashboard/reviews",
  "/dashboard/reports",
  "/dashboard/messages",
  "/dashboard/posts",
  "/dashboard/hashtags",
  "/dashboard/support",
  "/dashboard/notifications",
];

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

    // Granular enforcement aligned with ADMIN UI permission matrix.
    if (session.role === "manager") {
      if (managerBlockedPrefixes.some((p) => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL("/dashboard?error=role", request.url));
      }
    } else if (session.role === "moderator") {
      const isAllowed = moderatorAllowedPrefixes.some((p) => pathname.startsWith(p)) || pathname === "/dashboard";
      if (!isAllowed) {
        return NextResponse.redirect(new URL("/dashboard/communities?error=role", request.url));
      }
    } else {
      const allowed = roleRoutes[session.role];
      if (allowed) {
        if (!allowed.some((route) => pathname.startsWith(route))) {
          const fallback = allowed[0];
          const url = fallback === "/dashboard" ? new URL("/dashboard", request.url) : new URL(`${fallback}?error=role`, request.url);
          return NextResponse.redirect(url);
        }
      } else {
        // Default-deny: unknown/staff roles (finance, support, legacy raw
        // strings — the session carries the RAW db role, not the normalized
        // one) previously fell through to FULL dashboard access. Fail closed
        // to moderator scope instead.
        const ok =
          pathname === "/dashboard" ||
          moderatorAllowedPrefixes.some((p) => pathname.startsWith(p));
        if (!ok) {
          return NextResponse.redirect(new URL("/dashboard?error=role", request.url));
        }
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};