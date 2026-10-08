import assert from "node:assert/strict";

const baseUrl = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  baseUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
  "MCP verification must use a local server",
);

let id = 0;
let protocolVersion;
async function rpc(method, params, token) {
  const requestId = ++id;
  const response = await fetch(new URL("/chatgpt/mcp", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "accept-language": "en",
      ...(protocolVersion ? { "mcp-protocol-version": protocolVersion } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200, `${method}: HTTP ${response.status}`);
  const payload = await response.json();
  assert.equal(payload.jsonrpc, "2.0");
  assert.equal(payload.id, requestId);
  return payload;
}

const initialized = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "ottline-dependency-verifier", version: "1.0.0" },
});
assert.equal(initialized.result?.serverInfo.name, "ottline-chatgpt");
protocolVersion = initialized.result.protocolVersion;
assert.ok(protocolVersion);

const tools = (await rpc("tools/list", {})).result?.tools;
assert.equal(tools?.length, 1);
const tool = tools[0];
assert.equal(tool.name, "timeline.list_recent_logs");
assert.equal(tool.annotations.readOnlyHint, true);
assert.equal(tool.annotations.destructiveHint, false);
assert.deepEqual(tool.securitySchemes, [
  { type: "oauth2", scopes: ["timeline.read"] },
]);
assert.equal(tool.inputSchema.properties.limit.maximum, 50);

const resources = (await rpc("resources/list", {})).result?.resources;
assert.ok(
  resources.some((resource) => resource.uri === "ui://ottline/chatgpt.html"),
);
const resource = await rpc("resources/read", {
  uri: "ui://ottline/chatgpt.html",
});
assert.match(resource.result.contents[0].mimeType, /^text\/html/);
assert.match(resource.result.contents[0].text, /<html|<!doctype html/i);

for (const token of [undefined, "invalid-access-token"]) {
  const called = await rpc(
    "tools/call",
    { name: tool.name, arguments: { limit: 1 } },
    token,
  );
  assert.equal(called.result?.isError, true);
  assert.equal(called.result.structuredContent.authRequired, true);
  assert.equal(called.result.structuredContent.mode, "signed_out");
  assert.match(
    called.result._meta["mcp/www_authenticate"][0],
    /timeline\.read/,
  );
}

const invalid = await rpc("tools/call", {
  name: tool.name,
  arguments: { limit: 51 },
});
assert.equal(invalid.result?.isError, true, "Invalid tool input is rejected");
assert.match(invalid.result.content[0].text, /limit/);
assert.equal(invalid.result.structuredContent?.authRequired, undefined);
console.log(
  "PASS: MCP initialization, read-only tool/resource contracts, authentication and Zod validation",
);
