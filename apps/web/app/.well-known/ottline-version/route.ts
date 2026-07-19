export const dynamic = "force-dynamic";

export function GET() {
  const version = process.env.APP_VERSION?.trim();
  if (!version) {
    return new Response("Version unavailable", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return new Response(version, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
