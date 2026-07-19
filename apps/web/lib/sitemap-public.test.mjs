import assert from "node:assert/strict";
import test from "node:test";
import { loadLatestPublicLogDate } from "./sitemap-public.mjs";

test("reads locale-specific public dates with an Accept-Language header", async () => {
  const requestedLocales = [];
  const dates = {
    ko: "2026-07-18T01:00:00.000Z",
    en: "2026-07-19T02:00:00.000Z",
  };
  const fetchImpl = async (_url, init) => {
    const locale = init.headers["Accept-Language"];
    requestedLocales.push(locale);
    return new Response(JSON.stringify([{ createdAt: dates[locale] }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const [ko, en] = await Promise.all(
    ["ko", "en"].map((locale) =>
      loadLatestPublicLogDate({
        backendUrl: "http://ott-api:8080/",
        locale,
        fetchImpl,
      }),
    ),
  );

  assert.deepEqual(requestedLocales.sort(), ["en", "ko"]);
  assert.equal(ko?.toISOString(), dates.ko);
  assert.equal(en?.toISOString(), dates.en);
});

test("omits last-modified when the public feed is unavailable", async () => {
  const latest = await loadLatestPublicLogDate({
    backendUrl: "http://ott-api:8080",
    locale: "ko",
    fetchImpl: async () => new Response("unavailable", { status: 503 }),
  });

  assert.equal(latest, undefined);
});
