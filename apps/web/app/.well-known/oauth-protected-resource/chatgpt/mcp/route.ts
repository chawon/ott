import { createProtectedResourceMetadata } from "@/lib/chatgpt/metadata";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET(request: Request) {
  return Response.json(createProtectedResourceMetadata(request));
}
