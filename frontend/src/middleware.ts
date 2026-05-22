import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Server-side auth guard — prevents flash of protected content.
 *
 * Reads `auth_token` cookie (synced from localStorage via AuthProvider)
 * to determine if user is authenticated before the page renders.
 *
 * NOTE: The actual JWT is stored in localStorage for API calls.
 * The cookie only contains a role hint ("user" | "admin") — NOT the actual token.
 */

const PUBLIC_PATHS = ["/", "/login", "/register"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authRole = request.cookies.get("auth_role")?.value;

  // Allow public routes
  if (isPublicPath(pathname)) {
    // If already logged in, redirect away from auth pages
    if (authRole && (pathname === "/login" || pathname === "/register")) {
      const dashboardUrl = authRole === "admin" ? "/admin" : "/user";
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    return NextResponse.next();
  }

  // Protected routes — redirect to login if no auth cookie
  if (!authRole) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based protection — admin pages require admin role
  if (pathname.startsWith("/admin") && authRole !== "admin") {
    return NextResponse.redirect(new URL("/user", request.url));
  }

  // User pages — admin can access (optional: redirect admin to /admin)
  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes EXCEPT static assets and API routes
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
