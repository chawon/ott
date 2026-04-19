import crypto from "node:crypto";

import {
  CHATGPT_OAUTH_ISSUER,
  CHATGPT_RESOURCE_URL,
  requireChatGptSecret,
} from "@/lib/chatgpt/config";

const TOKEN_PREFIX = "ottcg";
const TOKEN_VERSION = "v1";

type SignedPayload = {
  type: string;
  exp: number;
  iat: number;
};

export type ChatGptAccessTokenPayload = SignedPayload & {
  type: "access";
  iss: string;
  aud: string;
  cid: string;
  uid: string;
  did: string;
  scp: string[];
  sub: string;
};

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding =
    normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function signPayloadSegment(payloadSegment: string) {
  return base64UrlEncode(
    crypto
      .createHmac("sha256", requireChatGptSecret())
      .update(payloadSegment)
      .digest(),
  );
}

function parseToken(token: string): SignedPayload | null {
  const [prefix, version, payloadSegment, signatureSegment] = token.split(".");
  if (
    prefix !== TOKEN_PREFIX ||
    version !== TOKEN_VERSION ||
    !payloadSegment ||
    !signatureSegment
  ) {
    return null;
  }

  const expected = signPayloadSegment(payloadSegment);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signatureSegment);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadSegment)) as SignedPayload;
    if (!parsed.exp || parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string) {
  const parsed = parseToken(token);
  if (!parsed || parsed.type !== "access") {
    return null;
  }
  const payload = parsed as ChatGptAccessTokenPayload;
  if (
    payload.iss !== CHATGPT_OAUTH_ISSUER ||
    payload.aud !== CHATGPT_RESOURCE_URL ||
    !payload.uid ||
    !payload.did ||
    !payload.cid ||
    !Array.isArray(payload.scp)
  ) {
    return null;
  }
  return payload;
}
