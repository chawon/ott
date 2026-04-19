import { createAuthorizationServerMetadata } from "@/lib/chatgpt/metadata";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return Response.json(createAuthorizationServerMetadata(request));
}
