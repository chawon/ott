import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { listLogs } from "@/lib/chatgpt/backend";
import { resolveChatGptPublicOrigin } from "@/lib/chatgpt/config";
import {
  chatGptWidgetI18n,
  getChatGptCopy,
  resolveChatGptLocale,
} from "@/lib/chatgpt/copy";
import { verifyAccessToken } from "@/lib/chatgpt/tokens";
import { loadWidgetHtml } from "@/lib/chatgpt/widgetHtml";

type ToolExtra = {
  authInfo?: AuthInfo;
  requestInfo?: {
    headers: Record<string, string | string[] | undefined>;
  };
};

type Identity = {
  userId: string;
  deviceId: string;
  authMode: "oauth";
};

type LogSummary = {
  title: {
    type?: string;
    name?: string;
    year?: number | null;
    posterUrl?: string | null;
  };
  status?: string;
  rating?: number | null;
  note?: string | null;
  ott?: string | null;
  watchedAt?: string | null;
  place?: string | null;
  occasion?: string | null;
};

type UnauthorizedResult = ReturnType<typeof createUnauthorizedResult>;

type IdentityResolution =
  | {
      identity: Identity;
      error?: never;
    }
  | {
      identity?: never;
      error: UnauthorizedResult;
    };

const widgetUri = "ui://ottline/chatgpt.html";

const toolNames = {
  listRecentLogs: "timeline.list_recent_logs",
} as const;

const timelineReadScopes = ["timeline.read"] as const;
const timelineReadSecurityScheme = [
  { type: "oauth2", scopes: [...timelineReadScopes] },
] as const;

function createUnauthorizedResult(
  publicOrigin: string,
  message: string,
  scopes: readonly string[],
) {
  const metadataUrl = `${publicOrigin}/.well-known/oauth-protected-resource/chatgpt/mcp`;
  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    structuredContent: {
      authRequired: true,
      scopes,
      mode: "signed_out",
    },
    _meta: {
      "mcp/www_authenticate": [
        `Bearer resource_metadata="${metadataUrl}", scope="${scopes.join(" ")}", error="insufficient_scope", error_description="Connect ottline to continue"`,
      ],
    },
    isError: true,
  };
}

function getToolCopy(extra: ToolExtra) {
  const value = extra.requestInfo?.headers["accept-language"];
  const acceptLanguage = Array.isArray(value) ? value[0] : (value ?? null);
  return getChatGptCopy(resolveChatGptLocale(acceptLanguage)).tools;
}

function summarizeRecentLogs(items: unknown[]): LogSummary[] {
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const log = item as {
      title?: {
        type?: string;
        name?: string;
        year?: number | null;
        posterUrl?: string | null;
      };
      status?: string;
      rating?: number | null;
      note?: string | null;
      ott?: string | null;
      watchedAt?: string | null;
      place?: string | null;
      occasion?: string | null;
    };

    return [
      {
        title: {
          type: log.title?.type,
          name: log.title?.name,
          year: log.title?.year ?? null,
          posterUrl: log.title?.posterUrl ?? null,
        },
        status: log.status,
        rating: log.rating ?? null,
        note: log.note ?? null,
        ott: log.ott ?? null,
        watchedAt: log.watchedAt ?? null,
        place: log.place ?? null,
        occasion: log.occasion ?? null,
      },
    ];
  });
}

function resolveIdentity(
  extra: ToolExtra,
  publicOrigin: string,
  authRequiredMessage: string,
  scopes: readonly string[],
): IdentityResolution {
  const authInfo = extra.authInfo;
  if (authInfo) {
    const tokenUserId = authInfo.extra?.userId;
    const tokenDeviceId = authInfo.extra?.deviceId;
    const grantedScopes = new Set(authInfo.scopes ?? []);
    if (
      typeof tokenUserId === "string" &&
      typeof tokenDeviceId === "string" &&
      scopes.every((scope) => grantedScopes.has(scope))
    ) {
      return {
        identity: {
          userId: tokenUserId,
          deviceId: tokenDeviceId,
          authMode: "oauth" as const,
        },
      };
    }
  }

  return {
    error: createUnauthorizedResult(publicOrigin, authRequiredMessage, scopes),
  };
}

function createServer(
  publicOrigin: string,
  locale: ReturnType<typeof resolveChatGptLocale>,
) {
  const server = new McpServer({
    name: "ottline-chatgpt",
    version: "0.1.0",
  });
  const copy = getChatGptCopy(locale);

  registerAppResource(
    server,
    "ottline-chatgpt-widget",
    widgetUri,
    {
      description: copy.server.resourceDescription,
    },
    async () => ({
      contents: [
        {
          uri: widgetUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadWidgetHtml({
            defaultLocale: "ko",
            i18n: chatGptWidgetI18n,
            tools: toolNames,
          }),
          _meta: {
            ui: {
              csp: {
                resourceDomains: [publicOrigin, "https://image.tmdb.org"],
              },
            },
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    toolNames.listRecentLogs,
    {
      title: copy.server.recentLogsTitle,
      description: copy.server.recentLogsDescription,
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(20),
        type: z.enum(["movie", "series", "book"]).optional(),
        sort: z.enum(["history"]).optional(),
        status: z.enum(["DONE", "IN_PROGRESS", "WISHLIST"]).optional(),
        ott: z.string().optional(),
        place: z
          .enum([
            "HOME",
            "THEATER",
            "TRANSIT",
            "CAFE",
            "OFFICE",
            "LIBRARY",
            "BOOKSTORE",
            "SCHOOL",
            "PARK",
            "OUTDOOR",
            "ETC",
          ])
          .optional(),
        occasion: z
          .enum(["ALONE", "DATE", "FAMILY", "FRIENDS", "BREAK", "ETC"])
          .optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        securitySchemes: [...timelineReadSecurityScheme],
        ui: { resourceUri: widgetUri },
      },
    },
    async ({ limit, type, sort, status, ott, place, occasion }, extra) => {
      const toolCopy = getToolCopy(extra);
      const resolved = resolveIdentity(
        extra,
        publicOrigin,
        toolCopy.authRequired,
        timelineReadScopes,
      );
      if (resolved.error) {
        return resolved.error;
      }
      const { userId, deviceId, authMode } = resolved.identity;
      let recentLogs: unknown[];
      try {
        recentLogs = await listLogs({
          userId,
          deviceId,
          limit,
          titleType: type,
          sort,
          status,
          ott,
          place,
          occasion,
        });
      } catch (error) {
        console.error("Failed to load recent logs for ottline ChatGPT", error);
        return {
          content: [
            {
              type: "text",
              text: toolCopy.recentLogsUnavailable,
            },
          ],
          structuredContent: {
            mode: authMode,
            recentLogs: [],
          },
          isError: true,
        };
      }
      const summarizedLogs = summarizeRecentLogs(recentLogs);

      return {
        content: [
          {
            type: "text",
            text:
              summarizedLogs.length === 0
                ? toolCopy.recentLogsEmpty
                : type === "movie"
                  ? toolCopy.recentMovieLogsLoaded
                  : type === "series"
                    ? toolCopy.recentSeriesLogsLoaded
                    : type === "book"
                      ? toolCopy.recentBookLogsLoaded
                      : toolCopy.recentLogsLoaded,
          },
        ],
        structuredContent: {
          mode: authMode,
          recentLogs: summarizedLogs,
        },
      };
    },
  );

  return server;
}

function buildAuthInfo(request: Request): AuthInfo | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  const token = authorization.slice("Bearer ".length).trim();
  const payload = verifyAccessToken(token);
  if (!payload) {
    return undefined;
  }
  return {
    token,
    clientId: payload.cid,
    scopes: payload.scp,
    expiresAt: payload.exp,
    resource: new URL(payload.aud),
    extra: {
      userId: payload.uid,
      deviceId: payload.did,
      subject: payload.sub,
    },
  };
}

async function getJsonRpcMethod(request: Request) {
  if (request.method !== "POST") {
    return null;
  }

  try {
    const payload = await request.clone().json();
    if (payload && typeof payload === "object" && "method" in payload) {
      const method = (payload as { method?: unknown }).method;
      return typeof method === "string" ? method : null;
    }
  } catch {
    return null;
  }

  return null;
}

async function patchToolsListResponse(response: Response) {
  try {
    const payload = await response.clone().json();
    if (!payload || typeof payload !== "object") {
      return response;
    }

    const result = (payload as { result?: { tools?: unknown[] } }).result;
    if (!result?.tools || !Array.isArray(result.tools)) {
      return response;
    }

    const tools = result.tools.map((tool) => {
      if (!tool || typeof tool !== "object") {
        return tool;
      }

      const meta = (tool as { _meta?: { securitySchemes?: unknown } })._meta;
      if (!meta?.securitySchemes) {
        return tool;
      }

      return {
        ...tool,
        securitySchemes: meta.securitySchemes,
      };
    });

    const patched = {
      ...payload,
      result: {
        ...result,
        tools,
      },
    };

    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(patched), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

export async function handleMcpRequest(request: Request) {
  const jsonRpcMethod = await getJsonRpcMethod(request);
  const server = createServer(
    resolveChatGptPublicOrigin(request),
    resolveChatGptLocale(request.headers.get("accept-language")),
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      authInfo: buildAuthInfo(request),
    });
    if (jsonRpcMethod === "tools/list") {
      return patchToolsListResponse(response);
    }
    return response;
  } finally {
    await transport.close();
    await server.close();
  }
}
