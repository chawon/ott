import {
  CHATGPT_SCOPES,
  resolveChatGptDocsUrl,
  resolveChatGptOauthIssuer,
  resolveChatGptResourceUrl,
} from "@/lib/chatgpt/config";

export function createProtectedResourceMetadata(request: Request) {
  const resource = resolveChatGptResourceUrl(request);
  const issuer = resolveChatGptOauthIssuer(request);

  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: [...CHATGPT_SCOPES],
    resource_name: "ottline ChatGPT app",
    resource_documentation: resolveChatGptDocsUrl(request),
    bearer_methods_supported: ["header"],
  };
}

export function createAuthorizationServerMetadata(request: Request) {
  const issuer = resolveChatGptOauthIssuer(request);
  const resource = resolveChatGptResourceUrl(request);

  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...CHATGPT_SCOPES],
    service_documentation: resolveChatGptDocsUrl(request),
    protected_resources: [resource],
  };
}
