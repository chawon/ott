import assert from "node:assert/strict";
import test from "node:test";

import { validateAdminMutationRequest } from "./admin-mutation-request.mjs";

const replyUrl =
  "http://ott-web:3000/admin/api/feedback/threads/00000000-0000-4000-8000-000000000001/reply";

function mutationRequest(headers = {}) {
  return new Request(replyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ body: "확인했습니다." }),
  });
}

test("accepts an admin JSON mutation from the public origin behind the trusted proxy", () => {
  const request = mutationRequest({
    Origin: "https://ottline.app",
    "X-Forwarded-Host": "ottline.app",
    "X-Forwarded-Proto": "https",
  });

  assert.equal(validateAdminMutationRequest(request), null);
});

test("accepts the first public origin values from a proxy chain", () => {
  const request = mutationRequest({
    Origin: "https://ottline.app",
    "X-Forwarded-Host": "ottline.app, ott-web:3000",
    "X-Forwarded-Proto": "https, http",
  });

  assert.equal(validateAdminMutationRequest(request), null);
});

test("accepts a direct same-origin JSON mutation", () => {
  const request = new Request(
    replyUrl.replace("http://ott-web:3000", "https://ottline.app"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://ottline.app",
      },
      body: JSON.stringify({ body: "확인했습니다." }),
    },
  );

  assert.equal(validateAdminMutationRequest(request), null);
});

test("rejects a missing or cross-site origin", () => {
  const proxyHeaders = {
    "X-Forwarded-Host": "ottline.app",
    "X-Forwarded-Proto": "https",
  };

  assert.deepEqual(
    validateAdminMutationRequest(mutationRequest(proxyHeaders)),
    {
      body: "Invalid origin",
      status: 403,
    },
  );
  assert.deepEqual(
    validateAdminMutationRequest(
      mutationRequest({ ...proxyHeaders, Origin: "https://example.com" }),
    ),
    { body: "Invalid origin", status: 403 },
  );
});

test("rejects malformed proxy origin headers", () => {
  assert.deepEqual(
    validateAdminMutationRequest(
      mutationRequest({
        Origin: "https://ottline.app",
        "X-Forwarded-Host": "ottline.app/path",
        "X-Forwarded-Proto": "https",
      }),
    ),
    { body: "Invalid origin", status: 403 },
  );
  assert.deepEqual(
    validateAdminMutationRequest(
      mutationRequest({
        Origin: "https://ottline.app",
        "X-Forwarded-Host": "ottline.app",
        "X-Forwarded-Proto": "javascript",
      }),
    ),
    { body: "Invalid origin", status: 403 },
  );
});

test("still requires an application/json body", () => {
  const request = new Request(replyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Origin: "https://ottline.app",
      "X-Forwarded-Host": "ottline.app",
      "X-Forwarded-Proto": "https",
    },
    body: "확인했습니다.",
  });

  assert.deepEqual(validateAdminMutationRequest(request), {
    body: "Content-Type must be application/json",
    status: 415,
  });
});
