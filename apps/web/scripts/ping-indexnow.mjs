import { pathToFileURL } from "node:url";

export const INDEXNOW_KEY = "9cdd845a2cc74943a9c950e5de656b48";
export const SITE_ORIGIN = "https://ottline.app";
export const VERSION_URL = `${SITE_ORIGIN}/.well-known/ottline-version`;

export function extractSitemapUrls(xml, origin = SITE_ORIGIN) {
  const expectedOrigin = new URL(origin).origin;
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .filter((value) => {
      try {
        return new URL(value).origin === expectedOrigin;
      } catch {
        return false;
      }
    });

  return [...new Set(urls)];
}

export async function waitForProductionVersion({
  expectedVersion,
  fetchImpl = fetch,
  versionUrl = VERSION_URL,
  attempts = 30,
  delayMs = 10_000,
  sleepImpl = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const expected = expectedVersion?.trim().slice(0, 7);
  if (!expected) return;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(versionUrl, {
        cache: "no-store",
        headers: { Accept: "text/plain" },
      });
      if (response.ok && (await response.text()).trim() === expected) return;
    } catch {
      // A rollout can briefly make the endpoint unavailable; retry below.
    }

    if (attempt < attempts) await sleepImpl(delayMs);
  }

  throw new Error(`Production did not reach app version ${expected}`);
}

export async function notifyIndexNow({
  fetchImpl = fetch,
  sitemapUrl = `${SITE_ORIGIN}/sitemap.xml`,
  endpoint = "https://api.indexnow.org/IndexNow",
} = {}) {
  const sitemapResponse = await fetchImpl(sitemapUrl, {
    headers: { Accept: "application/xml, text/xml" },
  });
  if (!sitemapResponse.ok) {
    throw new Error(
      `Sitemap fetch failed: ${sitemapResponse.status} ${sitemapResponse.statusText}`,
    );
  }

  const urlList = extractSitemapUrls(await sitemapResponse.text());
  if (urlList.length === 0) {
    throw new Error("Sitemap did not contain any ottline.app URLs");
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE_ORIGIN).host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `IndexNow failed: ${response.status} ${response.statusText} ${body}`.trim(),
    );
  }

  return { status: response.status, submitted: urlList.length };
}

export async function runCommand(command, options = {}) {
  if (command === "verify-production") {
    const expectedVersion = options.expectedVersion?.trim();
    if (!expectedVersion) {
      throw new Error(
        "EXPECTED_APP_VERSION is required for production verification",
      );
    }

    await waitForProductionVersion(options);
    return {
      action: "verified",
      version: expectedVersion.slice(0, 7),
    };
  }

  if (command === "notify") {
    return {
      action: "notified",
      ...(await notifyIndexNow(options)),
    };
  }

  throw new Error(`Unknown command: ${command}`);
}

async function main() {
  const result = await runCommand(process.argv[2] ?? "notify", {
    expectedVersion: process.env.EXPECTED_APP_VERSION,
  });

  if (result.action === "verified") {
    console.log(`Production reached app version ${result.version}.`);
    return;
  }

  console.log(
    `IndexNow accepted ${result.submitted} URLs with status ${result.status}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
