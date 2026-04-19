import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/chatgpt" || pathname.startsWith("/chatgpt/")) {
    return NextResponse.next();
  }

  return handleI18n(request);
}

export const config = {
  // Match only internationalized pathnames
  matcher: [
    "/",
    "/(ko|en)/:path*",
    "/((?!api|_next|_vercel|chatgpt|.*\\..*).*)",
  ],
};
