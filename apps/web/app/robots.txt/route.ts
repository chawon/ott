export const dynamic = "force-static";

export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /og/

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GoogleOther
Allow: /

Sitemap: https://ottline.app/sitemap.xml
llms-txt: https://ottline.app/llms.txt

#DaumWebMasterTool:d103e841a1b3ae8367101a53f5c003776c6cc1c4f9e37815dec535db5820e1c3:mw/Xf5RHiIQGISoi5Dg2Vw==`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
  });
}
