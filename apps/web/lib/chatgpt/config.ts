const DEFAULT_PUBLIC_ORIGIN = "http://localhost:3000";
const DEFAULT_BACKEND_ORIGIN = "http://localhost:8080";

export const CHATGPT_PUBLIC_ORIGIN =
  process.env.CHATGPT_PUBLIC_ORIGIN ?? DEFAULT_PUBLIC_ORIGIN;
export const CHATGPT_BACKEND_ORIGIN =
  process.env.BACKEND_URL ?? DEFAULT_BACKEND_ORIGIN;
export const CHATGPT_RESOURCE_URL =
  process.env.CHATGPT_RESOURCE_SERVER_URL ??
  `${CHATGPT_PUBLIC_ORIGIN}/chatgpt/mcp`;
export const CHATGPT_OAUTH_ISSUER =
  process.env.CHATGPT_OAUTH_ISSUER ?? `${CHATGPT_PUBLIC_ORIGIN}/chatgpt/oauth`;
export const CHATGPT_DOCS_URL =
  process.env.CHATGPT_RESOURCE_DOCUMENTATION_URL ??
  `${CHATGPT_PUBLIC_ORIGIN}/chatgpt`;
export const CHATGPT_SCOPES = ["timeline.read"] as const;

type HeaderValue = string | string[] | undefined;
type HeaderSource = Request | Headers | Record<string, HeaderValue>;

function getHeader(source: HeaderSource, name: string) {
  if (source instanceof Request) {
    return source.headers.get(name) ?? undefined;
  }

  if (source instanceof Headers) {
    return source.get(name) ?? undefined;
  }

  const value = source[name];
  return Array.isArray(value) ? value[0] : value;
}

export function resolveChatGptPublicOrigin(source?: HeaderSource) {
  if (process.env.CHATGPT_PUBLIC_ORIGIN) {
    return process.env.CHATGPT_PUBLIC_ORIGIN;
  }

  if (source) {
    const proto =
      getHeader(source, "x-forwarded-proto") ??
      (source instanceof Request
        ? new URL(source.url).protocol.slice(0, -1)
        : undefined);
    const host =
      getHeader(source, "x-forwarded-host") ?? getHeader(source, "host");

    if (proto && host) {
      return `${proto}://${host}`;
    }

    if (source instanceof Request) {
      return new URL(source.url).origin;
    }
  }

  return DEFAULT_PUBLIC_ORIGIN;
}

export function resolveChatGptResourceUrl(source?: HeaderSource) {
  return (
    process.env.CHATGPT_RESOURCE_SERVER_URL ??
    `${resolveChatGptPublicOrigin(source)}/chatgpt/mcp`
  );
}

export function resolveChatGptOauthIssuer(source?: HeaderSource) {
  return (
    process.env.CHATGPT_OAUTH_ISSUER ??
    `${resolveChatGptPublicOrigin(source)}/chatgpt/oauth`
  );
}

export function resolveChatGptDocsUrl(source?: HeaderSource) {
  return (
    process.env.CHATGPT_RESOURCE_DOCUMENTATION_URL ??
    `${resolveChatGptPublicOrigin(source)}/chatgpt`
  );
}

export function requireChatGptSecret() {
  const secret = process.env.CHATGPT_APP_SECRET;
  if (!secret) {
    throw new Error("CHATGPT_APP_SECRET is required");
  }
  return secret;
}

export function getOpenAiAppsChallengeToken() {
  return process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim() || null;
}
