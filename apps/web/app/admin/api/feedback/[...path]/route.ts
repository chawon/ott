import { NextResponse } from "next/server";
import {
  CloudflareAccessConfigurationError,
  verifyCloudflareAccessRequest,
} from "@/lib/cloudflare-access.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateResponse(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function authorize(request: Request) {
  try {
    await verifyCloudflareAccessRequest(request);
    return null;
  } catch (error) {
    if (error instanceof CloudflareAccessConfigurationError) {
      console.error("Cloudflare Access admin configuration is incomplete");
      return privateResponse("Admin access is not configured", 503);
    }
    return privateResponse("Forbidden", 403);
  }
}

function feedbackEndpoint(
  method: "GET" | "POST",
  path: string[],
  requestUrl: URL,
) {
  if (method === "GET" && path.length === 1 && path[0] === "threads") {
    const parsedLimit = Number(requestUrl.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(200, Math.max(1, Math.floor(parsedLimit)))
      : 100;
    return `/internal/admin/feedback/threads?limit=${limit}`;
  }

  const threadId = path[1];
  if (
    method === "GET" &&
    path.length === 2 &&
    path[0] === "threads" &&
    threadId &&
    UUID_PATTERN.test(threadId)
  ) {
    return `/internal/admin/feedback/threads/${encodeURIComponent(threadId)}`;
  }

  if (
    method === "POST" &&
    path.length === 3 &&
    path[0] === "threads" &&
    threadId &&
    UUID_PATTERN.test(threadId) &&
    path[2] === "reply"
  ) {
    return `/internal/admin/feedback/threads/${encodeURIComponent(threadId)}/reply`;
  }

  return null;
}

async function forward(
  request: Request,
  context: RouteContext,
  method: "GET" | "POST",
) {
  const unauthorized = await authorize(request);
  if (unauthorized) return unauthorized;

  if (method === "POST") {
    const origin = request.headers.get("Origin");
    if (!origin || origin !== new URL(request.url).origin) {
      return privateResponse("Invalid origin", 403);
    }
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
      return privateResponse("Content-Type must be application/json", 415);
    }
  }

  const { path } = await context.params;
  const endpoint = feedbackEndpoint(method, path, new URL(request.url));
  if (!endpoint) return privateResponse("Not found", 404);

  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
  const adminToken =
    process.env.ADMIN_FEEDBACK_TOKEN?.trim() ||
    process.env.ADMIN_ANALYTICS_TOKEN?.trim();
  if (!backendUrl || !adminToken) {
    return privateResponse("Admin backend is not configured", 503);
  }

  let body: string | undefined;
  if (method === "POST") {
    body = await request.text();
    if (new TextEncoder().encode(body).byteLength > 16_384) {
      return privateResponse("Request body is too large", 413);
    }
  }

  try {
    const response = await fetch(`${backendUrl}${endpoint}`, {
      method,
      body,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Admin-Token": adminToken,
      },
      cache: "no-store",
      redirect: "manual",
    });
    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return privateResponse("Admin backend is unavailable", 502);
  }
}

export function GET(request: Request, context: RouteContext) {
  return forward(request, context, "GET");
}

export function POST(request: Request, context: RouteContext) {
  return forward(request, context, "POST");
}
