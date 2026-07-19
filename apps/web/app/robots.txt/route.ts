export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /internal/
Disallow: /og/
Disallow: /admin

Sitemap: https://ottline.app/sitemap.xml

#DaumWebMasterTool:d103e841a1b3ae8367101a53f5c003776c6cc1c4f9e37815dec535db5820e1c3:mw/Xf5RHiIQGISoi5Dg2Vw==`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
