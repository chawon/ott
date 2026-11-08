/** Exercise the real proxy cookie contract, including insecure LAN browser requests. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost", "172.24.75.199"].includes(base.hostname),
);
const output =
  process.env.LOCALE_COOKIE_QA_OUTPUT ??
  join(tmpdir(), "ottline-locale-cookie");
await mkdir(output, { recursive: true });
const cases = [
  {
    name: "LAN background EN must not replace chosen KO",
    path: "/en/about?_rsc=locale-test",
    cookie: "ko",
    headers: { Accept: "*/*", RSC: "1", "Next-Router-Prefetch": "1" },
    expected: null,
  },
  {
    name: "LAN background KO must not replace chosen EN",
    path: "/ko/about?_rsc=locale-test",
    cookie: "en",
    headers: { Accept: "*/*", RSC: "1" },
    expected: null,
  },
  {
    name: "known background requests preserve locale",
    path: "/en/about?_rsc=locale-test",
    cookie: "ko",
    headers: { Accept: "*/*", RSC: "1", "Sec-Fetch-Dest": "empty" },
    expected: null,
  },
  {
    name: "LAN document explicitly opens EN",
    path: "/en/about",
    cookie: "ko",
    headers: { Accept: "text/html,application/xhtml+xml" },
    expected: "en",
  },
  {
    name: "LAN document explicitly opens KO",
    path: "/ko/about",
    cookie: "en",
    headers: { Accept: "text/html,application/xhtml+xml" },
    expected: "ko",
  },
  {
    name: "document metadata preserves normal locale switching",
    path: "/en/about",
    cookie: "ko",
    headers: { Accept: "text/html", "Sec-Fetch-Dest": "document" },
    expected: "en",
  },
  {
    name: "unprefixed document uses chosen KO",
    path: "/about",
    cookie: "ko",
    headers: { Accept: "text/html" },
    expected: null,
    status: 200,
    locale: "ko",
  },
];
const results = [];
try {
  for (const scenario of cases) {
    const response = await fetch(new URL(scenario.path, base), {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: `NEXT_LOCALE=${scenario.cookie}`,
        ...scenario.headers,
      },
    });
    const cookie =
      response.headers
        .getSetCookie()
        .find((value) => value.startsWith("NEXT_LOCALE="))
        ?.match(/^NEXT_LOCALE=([^;]*)/)?.[1] ?? null;
    const result = { name: scenario.name, status: response.status, cookie };
    results.push(result);
    console.log(JSON.stringify(result));
    assert.equal(cookie, scenario.expected, scenario.name);
    assert.ok(response.status === 200 || response.status === 307);
    if (scenario.status) assert.equal(response.status, scenario.status);
    if (scenario.locale)
      assert.match(
        await response.text(),
        new RegExp(`<html[^>]* lang="${scenario.locale}"`),
      );
    else await response.body?.cancel();
  }
  console.log(`PASS ${results.length} locale response scenarios`);
} finally {
  await writeFile(
    join(output, "result.json"),
    JSON.stringify(results, null, 2),
  );
}
