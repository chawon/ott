import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import {
  CloudflareAccessConfigurationError,
  isAdminPath,
  legacyAdminTarget,
  verifyCloudflareAccessRequest,
} from "./lib/cloudflare-access.mjs";

const handleI18n = createMiddleware(routing);

function withPrivateAdminHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const legacyTarget = legacyAdminTarget(pathname);
  if (legacyTarget) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = legacyTarget;
    redirectUrl.search = "";
    redirectUrl.hash = "";
    return withPrivateAdminHeaders(NextResponse.redirect(redirectUrl, 308));
  }

  if (isAdminPath(pathname)) {
    if (request.nextUrl.searchParams.has("token")) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.search = "";
      cleanUrl.hash = "";
      return withPrivateAdminHeaders(NextResponse.redirect(cleanUrl, 308));
    }

    try {
      await verifyCloudflareAccessRequest(request);
      return withPrivateAdminHeaders(NextResponse.next());
    } catch (error) {
      if (error instanceof CloudflareAccessConfigurationError) {
        console.error("Cloudflare Access admin configuration is incomplete");
        return withPrivateAdminHeaders(
          new NextResponse("Admin access is not configured", { status: 503 }),
        );
      }
      return withPrivateAdminHeaders(
        new NextResponse("Forbidden", { status: 403 }),
      );
    }
  }

  if (pathname === "/chatgpt" || pathname.startsWith("/chatgpt/")) {
    return NextResponse.next();
  }
  if (pathname === "/og" || pathname.startsWith("/og/")) {
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
