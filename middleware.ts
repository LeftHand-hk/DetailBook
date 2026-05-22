import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dashboard routes + the standalone booking-page editor — require
  // the user token. The editor lives outside /dashboard so it can
  // render full-screen without the dashboard layout, but it's still
  // owner-only.
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/booking-page-editor")) {
    const token = request.cookies.get("detailbook_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Staff routes — require staff token
  if (pathname.startsWith("/staff") && !pathname.startsWith("/staff/login")) {
    const token = request.cookies.get("detailbook_staff_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/staff/login", request.url));
    }
  }

  // Admin routes — require admin token
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get("detailbook_admin_token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/booking-page-editor/:path*", "/staff/:path*", "/admin/:path*"],
};
