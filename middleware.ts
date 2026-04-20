import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dashboard routes — require user token
  if (pathname.startsWith("/dashboard")) {
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
  matcher: ["/dashboard/:path*", "/staff/:path*", "/admin/:path*"],
};
