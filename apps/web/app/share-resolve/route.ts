import { NextRequest, NextResponse } from "next/server";

function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  const exact = new Set([
    "www.netflix.com",
    "www.disneyplus.com",
    "tv.apple.com",
    "app.primevideo.com",
    "www.tving.com",
    "coupangplay.app.link",
  ]);
  if (exact.has(h)) return true;
  return (
    h.endsWith(".netflix.com") ||
    h.endsWith(".disneyplus.com") ||
    h.endsWith(".apple.com") ||
    h.endsWith(".primevideo.com") ||
    h.endsWith(".tving.com")
  );
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTitleFromHtml(html: string): string | null {
  const metas = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ];
  for (const pattern of metas) {
    const m = html.match(pattern);
    if (m?.[1]) {
      const v = decodeHtmlEntities(m[1]).trim();
      if (v) return v.slice(0, 160);
    }
  }
  return null;
}

function withWebOnly(url: URL): URL {
  const next = new URL(url.toString());
  if (!next.searchParams.has("$web_only")) {
    next.searchParams.set("$web_only", "true");
  }
  return next;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "invalid protocol" }, { status: 400 });
  }
  if (!isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  try {
    const requestHeaders = {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "upgrade-insecure-requests": "1",
    };

    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      headers: requestHeaders,
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ title: null, resolvedUrl: res.url, status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json({ title: null, resolvedUrl: res.url, status: res.status });
    }

    const html = await res.text();
    let title = extractTitleFromHtml(html);

    // Branch app.link 계열은 웹 폴백 파라미터 재시도로 제목 추출률 개선
    if (!title && parsed.hostname.toLowerCase().endsWith("app.link")) {
      const retryUrl = withWebOnly(parsed);
      const retry = await fetch(retryUrl.toString(), {
        method: "GET",
        redirect: "follow",
        headers: requestHeaders,
        cache: "no-store",
      });
      if (retry.ok && (retry.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
        const retryHtml = await retry.text();
        title = extractTitleFromHtml(retryHtml);
        return NextResponse.json({ title, resolvedUrl: retry.url, status: retry.status });
      }
    }

    return NextResponse.json({ title, resolvedUrl: res.url, status: res.status });
  } catch {
    return NextResponse.json({ title: null, resolvedUrl: null, status: 500 });
  }
}
