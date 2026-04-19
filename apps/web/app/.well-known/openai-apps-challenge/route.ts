import { getOpenAiAppsChallengeToken } from "@/lib/chatgpt/config";

export const runtime = "nodejs";

export async function GET() {
  const token = getOpenAiAppsChallengeToken();

  if (!token) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(token, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
