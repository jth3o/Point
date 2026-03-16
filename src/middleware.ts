import { NextResponse } from "next/server";

/**
 * Edge middleware: no auth/MongoDB here (Edge does not support Node "stream").
 * Protected routes use server-side session checks in pages/layouts.
 * API routes use getAuthUserId() for protection.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
