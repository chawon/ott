import { NextResponse } from "next/server";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/cdn-cgi/access/logout", request.url));
}
