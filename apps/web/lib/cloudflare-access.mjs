import { createRemoteJWKSet, jwtVerify } from "jose";

const remoteKeySets = new Map();

export class CloudflareAccessConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CloudflareAccessConfigurationError";
  }
}

export function normalizeCloudflareTeamDomain(value) {
  const raw = value?.trim();
  if (!raw) {
    throw new CloudflareAccessConfigurationError(
      "CF_ACCESS_TEAM_DOMAIN is not configured",
    );
  }

  const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new CloudflareAccessConfigurationError(
      "CF_ACCESS_TEAM_DOMAIN must be an HTTPS origin",
    );
  }

  return url.origin;
}

export function readCloudflareAccessConfig({ teamDomain, audience }) {
  const normalizedAudience = audience?.trim();
  if (!normalizedAudience) {
    throw new CloudflareAccessConfigurationError(
      "CF_ACCESS_ADMIN_AUD is not configured",
    );
  }

  return {
    issuer: normalizeCloudflareTeamDomain(teamDomain),
    audience: normalizedAudience,
  };
}

function remoteKeySetFor(issuer) {
  const certsUrl = new URL("/cdn-cgi/access/certs", `${issuer}/`).toString();
  const cached = remoteKeySets.get(certsUrl);
  if (cached) return cached;

  const keySet = createRemoteJWKSet(new URL(certsUrl));
  remoteKeySets.set(certsUrl, keySet);
  return keySet;
}

export async function verifyCloudflareAccessAssertion(
  assertion,
  config,
  options = {},
) {
  if (!assertion?.trim()) {
    throw new Error("Cf-Access-Jwt-Assertion is missing");
  }

  const keySet = options.keySet ?? remoteKeySetFor(config.issuer);
  const result = await jwtVerify(assertion, keySet, {
    algorithms: ["RS256"],
    issuer: config.issuer,
    audience: config.audience,
    clockTolerance: 5,
    requiredClaims: ["iss", "aud", "iat", "nbf", "exp", "type"],
  });

  if (result.payload.type !== "app") {
    throw new Error("Cloudflare Access token type must be app");
  }

  return result.payload;
}

export async function verifyCloudflareAccessRequest(request, options = {}) {
  const config = readCloudflareAccessConfig({
    teamDomain: options.teamDomain ?? process.env.CF_ACCESS_TEAM_DOMAIN,
    audience: options.audience ?? process.env.CF_ACCESS_ADMIN_AUD,
  });
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  return verifyCloudflareAccessAssertion(assertion, config, options);
}

export function isAdminPath(pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function legacyAdminTarget(pathname) {
  const match = pathname.match(/^\/(?:ko|en)\/admin(?:\/(.*))?\/?$/);
  if (!match) return null;
  return match[1] ? `/admin/${match[1]}` : "/admin";
}
