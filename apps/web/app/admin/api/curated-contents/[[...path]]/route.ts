import { NextResponse } from "next/server";
import { validateAdminMutationRequest } from "@/lib/admin-mutation-request.mjs";
import {
  CloudflareAccessConfigurationError,
  verifyCloudflareAccessRequest,
} from "@/lib/cloudflare-access.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
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

function boundedLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(1, Math.floor(parsed)))
    : fallback;
}

function endpoint(method: "GET" | "POST", path: string[], requestUrl: URL) {
  if (method === "GET" && path.length === 0) {
    const params = new URLSearchParams();
    const status = requestUrl.searchParams.get("status");
    const locale = requestUrl.searchParams.get("locale");
    if (status) params.set("status", status);
    if (locale) params.set("locale", locale);
    params.set(
      "limit",
      String(boundedLimit(requestUrl.searchParams.get("limit"), 50, 200)),
    );
    return `/internal/admin/curated-contents?${params}`;
  }

  if (method === "GET" && path.length === 1 && path[0] === "titles") {
    const q = requestUrl.searchParams.get("q")?.trim() ?? "";
    const params = new URLSearchParams({
      q,
      limit: String(boundedLimit(requestUrl.searchParams.get("limit"), 10, 20)),
    });
    return `/internal/admin/curated-contents/titles?${params}`;
  }

  if (method === "POST" && path.length === 1 && path[0] === "drafts") {
    return "/internal/admin/curated-contents/drafts";
  }

  if (
    method === "POST" &&
    path.length === 2 &&
    UUID_PATTERN.test(path[0]) &&
    (path[1] === "publish" || path[1] === "disable")
  ) {
    return `/internal/admin/curated-contents/${encodeURIComponent(path[0])}/${path[1]}`;
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
    const validationError = validateAdminMutationRequest(request);
    if (validationError) {
      return privateResponse(validationError.body, validationError.status);
    }
  }

  const { path = [] } = await context.params;
  const target = endpoint(method, path, new URL(request.url));
  if (!target) return privateResponse("Not found", 404);

  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
  const adminToken =
    process.env.ADMIN_CURATED_CONTENT_TOKEN?.trim() ||
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
    const response = await fetch(`${backendUrl}${target}`, {
      method,
      body,
      headers: {
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
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
