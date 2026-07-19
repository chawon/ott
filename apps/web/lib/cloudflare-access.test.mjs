import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  isAdminPath,
  legacyAdminTarget,
  normalizeCloudflareTeamDomain,
  readCloudflareAccessConfig,
  verifyCloudflareAccessAssertion,
} from "./cloudflare-access.mjs";

const issuer = "https://ottline.cloudflareaccess.com";
const audience = "admin-application-aud";

async function createAccessToken(overrides = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test-key";
  publicJwk.alg = "RS256";
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    type: "app",
    ...overrides.claims,
  };
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? audience)
    .setIssuedAt(now)
    .setNotBefore(overrides.notBefore ?? now - 1)
    .setExpirationTime(overrides.expiresAt ?? now + 60)
    .sign(privateKey);

  return {
    token,
    keySet: createLocalJWKSet({ keys: [publicJwk] }),
  };
}

test("accepts a signed Cloudflare Access app token", async () => {
  const { token, keySet } = await createAccessToken();
  const payload = await verifyCloudflareAccessAssertion(
    token,
    { issuer, audience },
    { keySet },
  );
  assert.equal(payload.type, "app");
});

test("rejects wrong issuer, audience, time window, and token type", async () => {
  const cases = [
    await createAccessToken({ issuer: `${issuer}/wrong` }),
    await createAccessToken({ audience: "other-application" }),
    await createAccessToken({ expiresAt: 1 }),
    await createAccessToken({ claims: { type: "org" } }),
  ];

  for (const { token, keySet } of cases) {
    await assert.rejects(
      verifyCloudflareAccessAssertion(token, { issuer, audience }, { keySet }),
    );
  }
});

test("normalizes configuration and fails closed when it is incomplete", () => {
  assert.equal(
    normalizeCloudflareTeamDomain("ottline.cloudflareaccess.com/"),
    issuer,
  );
  assert.deepEqual(
    readCloudflareAccessConfig({
      teamDomain: `${issuer}/`,
      audience: ` ${audience} `,
    }),
    { issuer, audience },
  );
  assert.throws(() =>
    readCloudflareAccessConfig({ teamDomain: issuer, audience: "" }),
  );
});

test("identifies protected and legacy admin paths without query data", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/api/feedback/threads"), true);
  assert.equal(isAdminPath("/administrator"), false);
  assert.equal(legacyAdminTarget("/ko/admin/analytics"), "/admin/analytics");
  assert.equal(legacyAdminTarget("/en/admin"), "/admin");
  assert.equal(legacyAdminTarget("/en/about"), null);
});
