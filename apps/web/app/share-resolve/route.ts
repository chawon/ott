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
    const res = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
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
    const title = extractTitleFromHtml(html);
    return NextResponse.json({ title, resolvedUrl: res.url, status: res.status });
  } catch {
    return NextResponse.json({ title: null, resolvedUrl: null, status: 500 });
  }
}
