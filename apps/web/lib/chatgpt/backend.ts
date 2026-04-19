import { CHATGPT_BACKEND_ORIGIN } from "@/lib/chatgpt/config";

type BackendRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  userId?: string;
  deviceId?: string;
  acceptLanguage?: string | null;
  userAgent?: string | null;
};

async function backendJson<T>(
  path: string,
  {
    method = "GET",
    body,
    userId,
    deviceId,
    acceptLanguage,
    userAgent,
  }: BackendRequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (acceptLanguage) {
    headers.set("Accept-Language", acceptLanguage);
  }
  if (userId) {
    headers.set("X-User-Id", userId);
  }
  if (deviceId) {
    headers.set("X-Device-Id", deviceId);
  }
  if (userAgent) {
    headers.set("User-Agent", userAgent);
  }

  const response = await fetch(`${CHATGPT_BACKEND_ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Backend ${response.status}: ${text || response.statusText}`,
    );
  }

  const text = await response.text();
  if (!text) {
    return null as T;
  }
  return JSON.parse(text) as T;
}

export async function listLogs({
  userId,
  deviceId,
  limit,
  sort,
  status,
  titleType,
  ott,
  place,
  occasion,
}: {
  userId: string;
  deviceId: string;
  limit: number;
  sort?: string;
  status?: string;
  titleType?: string;
  ott?: string;
  place?: string;
  occasion?: string;
}) {
  const effectiveLimit = titleType ? Math.max(limit * 5, 50) : limit;
  const params = new URLSearchParams({ limit: String(effectiveLimit) });
  if (sort) {
    params.set("sort", sort);
  }
  if (status) {
    params.set("status", status);
  }
  if (ott) {
    params.set("ott", ott);
  }
  if (place) {
    params.set("place", place);
  }
  if (occasion) {
    params.set("occasion", occasion);
  }
  const logs = await backendJson<unknown[]>(`/api/logs?${params.toString()}`, {
    userId,
    deviceId,
  });

  if (!titleType) {
    return logs;
  }

  return logs
    .filter((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const title = (item as { title?: { type?: string } }).title;
      return title?.type === titleType;
    })
    .slice(0, limit);
}
