import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const baseUrl = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  baseUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
  "MCP verification must use a local server",
);

const backendUrl = new URL(process.env.MCP_TEST_BACKEND_URL);
assert.ok(
  backendUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(backendUrl.hostname),
  "MCP fixture must use a local backend",
);
assert.equal(new URL(process.env.BACKEND_URL).origin, backendUrl.origin);
const secret = process.env.CHATGPT_APP_SECRET;
assert.ok(secret, "The local verification server must have a test signing key");
assert.equal(process.env.CHATGPT_PUBLIC_ORIGIN, baseUrl.origin);

const userId = "11111111-1111-4111-8111-111111111111";
const deviceId = "22222222-2222-4222-8222-222222222222";
const summaries = ["movie", "series", "book", "movie"].map((type, index) => ({
  title: {
    type,
    name: `${type} fixture ${index + 1}`,
    year: 2026,
    posterUrl: null,
  },
  status: "DONE",
  rating: 4,
  note: "직접 남긴 메모 / personal note",
  ott: "Netflix",
  watchedAt: "2026-10-07T12:34:56Z",
  place: "HOME",
  occasion: "ALONE",
}));
const requests = [];
let fixtureMode = "normal";
const backend = createServer((request, response) => {
  const url = new URL(request.url, backendUrl);
  requests.push({ method: request.method, url, headers: request.headers });
  if (request.method !== "GET" || url.pathname !== "/api/logs") {
    response.writeHead(404).end();
    return;
  }
  if (fixtureMode === "unavailable") {
    response.writeHead(503).end("local fixture unavailable");
    return;
  }
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify(
      fixtureMode === "empty"
        ? []
        : summaries.map((log, index) => ({
            ...log,
            id: `fixture-${index}`,
            userId,
          })),
    ),
  );
});

function accessToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      type: "access",
      iss: `${baseUrl.origin}/chatgpt/oauth`,
      aud: `${baseUrl.origin}/chatgpt/mcp`,
      cid: "local-verification-client",
      uid: userId,
      did: deviceId,
      scp: ["timeline.read"],
      sub: userId,
      iat: now,
      exp: now + 300,
      ...overrides,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `ottcg.v1.${payload}.${signature}`;
}

let id = 0;
let protocolVersion;
async function rpc(method, params, token, locale = "en") {
  const requestId = ++id;
  const response = await fetch(new URL("/chatgpt/mcp", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "accept-language": locale,
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

await new Promise((resolve, reject) => {
  backend.once("error", reject);
  backend.listen(Number(backendUrl.port), backendUrl.hostname, resolve);
});
try {
  for (const requestedVersion of ["2025-06-18", "2025-11-25"]) {
    protocolVersion = undefined;
    requests.length = 0;
    fixtureMode = "normal";
    const initialized = await rpc("initialize", {
      protocolVersion: requestedVersion,
      capabilities: {},
      clientInfo: { name: "ottline-dependency-verifier", version: "1.0.0" },
    });
    assert.equal(initialized.result?.serverInfo.name, "ottline-chatgpt");
    protocolVersion = initialized.result.protocolVersion;
    assert.equal(protocolVersion, requestedVersion);

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
    assert.equal(tool._meta.ui.resourceUri, "ui://ottline/chatgpt.html");

    const resources = (await rpc("resources/list", {})).result?.resources;
    assert.ok(
      resources.some(
        (resource) => resource.uri === "ui://ottline/chatgpt.html",
      ),
    );
    const resource = await rpc("resources/read", {
      uri: "ui://ottline/chatgpt.html",
    });
    assert.match(resource.result.contents[0].mimeType, /^text\/html/);
    assert.match(resource.result.contents[0].text, /<html|<!doctype html/i);

    for (const token of [
      undefined,
      "invalid-access-token",
      accessToken({ scp: [] }),
      accessToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
      accessToken({ aud: `${baseUrl.origin}/another-resource` }),
      accessToken({ uid: "" }),
      `${accessToken()}tampered`,
    ]) {
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
    assert.equal(requests.length, 0, "Rejected tokens never reach the backend");

    const koreanAuth = await rpc(
      "tools/call",
      { name: tool.name, arguments: {} },
      undefined,
      "ko",
    );
    assert.match(koreanAuth.result.content[0].text, /연결/);

    const invalid = await rpc("tools/call", {
      name: tool.name,
      arguments: { limit: 51 },
    });
    assert.equal(
      invalid.result?.isError,
      true,
      "Invalid tool input is rejected",
    );
    assert.match(invalid.result.content[0].text, /limit/);
    assert.equal(invalid.result.structuredContent?.authRequired, undefined);
    assert.equal(
      requests.length,
      0,
      "Invalid arguments never reach the backend",
    );

    const unknown = await rpc("tools/call", {
      name: "timeline.unknown_tool",
      arguments: {},
    });
    assert.equal(
      unknown.error?.code,
      -32602,
      "SDK 2 rejects unknown tools as invalid params",
    );
    assert.equal(requests.length, 0, "Unknown tools never reach the backend");

    const token = accessToken();
    const loaded = await rpc(
      "tools/call",
      { name: tool.name, arguments: {} },
      token,
    );
    assert.equal(loaded.result.isError, undefined);
    assert.deepEqual(loaded.result.structuredContent, {
      mode: "oauth",
      recentLogs: summaries,
    });
    assert.equal(loaded.result.content[0].text, "Loaded your recent logs.");
    assert.equal(requests.at(-1).url.searchParams.get("limit"), "20");

    for (const type of ["movie", "series", "book"]) {
      const filtered = await rpc(
        "tools/call",
        {
          name: tool.name,
          arguments: {
            limit: 1,
            type,
            sort: "history",
            status: "DONE",
            ott: "Netflix",
            place: "HOME",
            occasion: "ALONE",
          },
        },
        token,
        "ko",
      );
      assert.deepEqual(filtered.result.structuredContent, {
        mode: "oauth",
        recentLogs: [summaries.find((log) => log.title.type === type)],
      });
      assert.match(
        filtered.result.content[0].text,
        /최근 .* 기록을 불러왔습니다/,
      );
      assert.deepEqual(Object.fromEntries(requests.at(-1).url.searchParams), {
        limit: "50",
        sort: "history",
        status: "DONE",
        ott: "Netflix",
        place: "HOME",
        occasion: "ALONE",
      });
    }
    for (const request of requests) {
      assert.equal(request.headers["x-user-id"], userId);
      assert.equal(request.headers["x-device-id"], deviceId);
      assert.equal(
        request.headers.authorization,
        undefined,
        "Bearer tokens stay on the web server",
      );
    }

    fixtureMode = "empty";
    const empty = await rpc(
      "tools/call",
      { name: tool.name, arguments: {} },
      token,
    );
    assert.deepEqual(empty.result.structuredContent, {
      mode: "oauth",
      recentLogs: [],
    });
    assert.equal(empty.result.content[0].text, "No recent logs found.");

    fixtureMode = "unavailable";
    const unavailable = await rpc(
      "tools/call",
      { name: tool.name, arguments: {} },
      token,
    );
    assert.equal(unavailable.result.isError, true);
    assert.deepEqual(unavailable.result.structuredContent, {
      mode: "oauth",
      recentLogs: [],
    });
    assert.equal(unavailable.result.structuredContent.authRequired, undefined);
    console.log(
      `PASS: MCP ${protocolVersion} initialization, read-only tool/resource contracts, token/scope boundaries, authenticated history/filters/locales, backend failures and Zod validation`,
    );
  }
} finally {
  await new Promise((resolve) => backend.close(resolve));
}
