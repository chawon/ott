import { handleMcpRequest } from "@/lib/chatgpt/mcpServer";

export const runtime = "nodejs";

function isPlainHealthCheck(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return (
    request.method === "GET" &&
    !accept.includes("text/event-stream") &&
    !request.headers.has("mcp-protocol-version") &&
    !request.headers.has("mcp-session-id")
  );
}

export async function GET(request: Request) {
  if (isPlainHealthCheck(request)) {
    return new Response("ottline ChatGPT MCP", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "authorization, content-type, mcp-protocol-version, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}
