import assert from "node:assert/strict";

const base = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
const origin = "https://ottline.app";
assert.ok(
  base.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname),
  "SEO runtime checks must use a local server",
);

function decode(value) {
  return value.replace(/&(?:amp|quot|lt|gt|#39|#x27);/g, (entity) => {
    return {
      "&amp;": "&",
      "&quot;": '"',
      "&lt;": "<",
      "&gt;": ">",
      "&#39;": "'",
      "&#x27;": "'",
    }[entity];
  });
}

function attributes(source) {
  return Object.fromEntries(
    [...source.matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1].toLowerCase(),
      decode(match[2] ?? match[3]),
    ]),
  );
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map(
    (match) => attributes(match[1]),
  );
}

async function request(pathname) {
  const response = await fetch(new URL(pathname, base), {
    redirect: "manual",
    headers: {
      "User-Agent": "Googlebot",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language":
        pathname === "/en" || pathname.startsWith("/en/") ? "en" : "ko",
    },
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(
    response.status,
    200,
    `${pathname}: HTTP ${response.status} ${response.headers.get("location") ?? ""}`,
  );
  return response;
}

const sitemapResponse = await request("/sitemap.xml");
assert.match(sitemapResponse.headers.get("content-type"), /xml/);
const sitemap = await sitemapResponse.text();
const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
  (match) => ({
    url: decode(match[1].match(/<loc>([^<]+)<\/loc>/)[1]),
    lastmod: match[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
    alternates: tags(match[1], "xhtml:link"),
  }),
);
assert.equal(entries.length, 19, "Sitemap contains only the 19 public URLs");
assert.equal(new Set(entries.map((entry) => entry.url)).size, entries.length);

const checkedImages = new Set();
const guideDates = { ko: [], en: [] };
let articles = 0;
for (const entry of entries) {
  const url = new URL(entry.url);
  assert.equal(url.origin, origin);
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  const pathname = url.pathname;
  const english = pathname === "/en" || pathname.startsWith("/en/");
  const locale = english ? "en" : "ko";
  const localPath = english ? pathname.slice(3) || "/" : pathname;
  const response = await request(pathname);
  const html = await response.text();
  const head = html.split("</head>")[0];
  const links = tags(head, "link");
  const metadata = tags(head, "meta");
  const meta = (key) =>
    metadata.find((tag) => tag.name === key || tag.property === key)?.content;

  assert.equal(
    links.find((tag) => tag.rel === "canonical")?.href,
    entry.url,
    `${pathname}: self-canonical`,
  );
  assert.equal(meta("og:url"), entry.url, `${pathname}: OG canonical`);
  assert.doesNotMatch(
    `${meta("robots") ?? ""} ${response.headers.get("x-robots-tag") ?? ""}`,
    /noindex/i,
  );
  const title = decode(head.match(/<title>([^<]*)<\/title>/)[1]);
  assert.equal(
    meta("og:title"),
    title,
    `${pathname}: OG title matches the page`,
  );
  assert.equal(
    meta("twitter:title"),
    title,
    `${pathname}: Twitter title matches the page`,
  );
  assert.equal(
    meta("twitter:description"),
    meta("og:description"),
    `${pathname}: per-page Twitter description`,
  );

  if (
    localPath === "/about" ||
    localPath === "/guide" ||
    localPath.startsWith("/guide/")
  ) {
    const publicMarkup = html.replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      "",
    );
    assert.doesNotMatch(
      publicMarkup,
      /chat\s*gpt/i,
      `${pathname}: published service guidance excludes the unavailable ChatGPT channel`,
    );
    for (const script of html.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    )) {
      if (attributes(script[1]).type === "application/ld+json") {
        assert.doesNotMatch(
          JSON.stringify(JSON.parse(script[2])),
          /chat\s*gpt/i,
          `${pathname}: structured guidance excludes ChatGPT promotion`,
        );
      }
    }
  }

  if (pathname !== "/chatgpt") {
    assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`));
    assert.equal(meta("twitter:card"), "summary_large_image");
    const koUrl = `${origin}${localPath}`;
    const enUrl = `${origin}/en${localPath === "/" ? "" : localPath}`;
    const expected = { ko: koUrl, en: enUrl, "x-default": koUrl };
    for (const [language, href] of Object.entries(expected)) {
      assert.equal(
        links.find((tag) => tag.hreflang === language)?.href,
        href,
        `${pathname}: HTML ${language}`,
      );
      assert.equal(
        entry.alternates.find((tag) => tag.hreflang === language)?.href,
        href,
        `${pathname}: XML ${language}`,
      );
    }
    assert.equal(
      meta("twitter:image"),
      meta("og:image"),
      `${pathname}: matching social image`,
    );
    const image = new URL(meta("og:image"));
    assert.equal(image.origin, origin);
    if (!checkedImages.has(image.pathname)) {
      const imageResponse = await request(image.pathname);
      assert.match(imageResponse.headers.get("content-type"), /^image\//);
      assert.ok((await imageResponse.arrayBuffer()).byteLength > 1000);
      checkedImages.add(image.pathname);
    }
    if (!localPath.startsWith("/guide/")) {
      assert.equal(
        image.pathname,
        "/brand/v2/og-image.png",
        `${pathname}: current brand image`,
      );
    }
  }

  if (["/", "/about", "/faq"].includes(localPath)) {
    assert.ok(
      Date.parse(entry.lastmod) >= Date.parse("2026-11-08T00:00:00+09:00"),
      `${pathname}: reflects the v2 release`,
    );
  }
  if (localPath === "/about") {
    const storeLink = tags(html, "a").find(
      (tag) => tag["data-testid"] === "about-windows-store-link",
    );
    assert.ok(storeLink, `${pathname}: server-rendered Windows store link`);
    const storeUrl = new URL(storeLink.href);
    assert.equal(storeUrl.origin, "https://apps.microsoft.com");
    assert.equal(storeUrl.pathname, "/detail/9nsvnzgdmgf5");
    assert.equal(storeUrl.searchParams.get("cid"), "about_platform_card");
    assert.equal(storeUrl.searchParams.get("hl"), english ? "en-us" : "ko-kr");
    assert.equal(storeUrl.searchParams.get("gl"), english ? "US" : "KR");
    assert.deepEqual([...storeUrl.searchParams.keys()].sort(), [
      "cid",
      "gl",
      "hl",
    ]);
    assert.match(html, /Windows 11/);
    assert.match(html, /Ctrl\+Shift\+O/);
    assert.doesNotMatch(html, /Ctrl\+Alt\+O/);
    const companionSection = html
      .match(/<section\b[^>]*>[\s\S]*?<\/section>/g)
      ?.find((section) =>
        section.includes(english ? "Companion tools" : "보조 도구"),
      );
    assert.ok(
      companionSection,
      `${pathname}: a separate companion tools section`,
    );
    for (const label of ["Chrome Web Store", "Edge Add-ons", "Whale Store"]) {
      assert.ok(companionSection.includes(label), `${pathname}: ${label} link`);
    }
    assert.doesNotMatch(
      html,
      /same web app is also available through Microsoft Store packaging|같은 웹 앱을 Microsoft Store 배포 형태/,
    );
    assert.equal(
      Date.parse(entry.lastmod),
      Date.parse("2026-11-22T00:00:00+09:00"),
    );
    const appStore = tags(html, "a").find((tag) =>
      tag.href?.startsWith("https://apps.apple.com/"),
    );
    assert.equal(
      new URL(appStore.href).search,
      "",
      "iPhone/iPad listing remains a direct store link",
    );
    const macAppStore = tags(html, "a").find((tag) => {
      if (!tag.href?.startsWith("https://apps.apple.com/")) return false;
      return new URL(tag.href).searchParams.get("platform") === "mac";
    });
    assert.ok(macAppStore, `${pathname}: server-rendered Mac App Store link`);
    const macStoreUrl = new URL(macAppStore.href);
    assert.match(macStoreUrl.pathname, /\/id6780318110$/);
    assert.deepEqual([...macStoreUrl.searchParams.keys()], ["platform"]);
    assert.match(html, /iPhone/);
    assert.match(html, /iPad/);
    assert.match(html, /macOS/);
    assert.equal(
      meta("apple-itunes-app"),
      undefined,
      "Smart App Banner is outside this PR",
    );
  }
  if (localPath.startsWith("/guide/")) {
    const script = [
      ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g),
    ].find((match) => attributes(match[1]).id === "guide-json-ld");
    assert.ok(script, `${pathname}: server-rendered guide structured data`);
    const data = JSON.parse(script[2]);
    const article = data["@graph"].find((item) => item["@type"] === "Article");
    const breadcrumb = data["@graph"].find(
      (item) => item["@type"] === "BreadcrumbList",
    );
    assert.equal(article.mainEntityOfPage["@id"], entry.url);
    assert.equal(
      article.headline,
      decode(html.match(/<h1\b[^>]*>([^<]*)<\/h1>/)[1]),
    );
    assert.equal(article.image[0], meta("og:image"));
    const visibleDate = tags(html, "time")[0].datetime;
    assert.equal(article.dateModified.slice(0, 10), visibleDate);
    assert.equal(Date.parse(article.dateModified), Date.parse(entry.lastmod));
    assert.deepEqual(
      breadcrumb.itemListElement.map((item) => item.item),
      [`${origin}${english ? "/en" : ""}/guide`, entry.url],
    );
    guideDates[locale].push(Date.parse(entry.lastmod));
    articles += 1;
  }
  console.log(`${pathname}: public metadata OK`);
}
assert.equal(articles, 6);
for (const locale of ["ko", "en"]) {
  const hubUrl = `${origin}${locale === "en" ? "/en" : ""}/guide`;
  assert.ok(
    Date.parse(entries.find((entry) => entry.url === hubUrl).lastmod) >=
      Math.max(...guideDates[locale]),
    `${locale}: guide hub follows its documents`,
  );
}

const privatePaths = [
  "/account",
  "/timeline",
  "/me/report",
  "/me/bookshelf",
  "/feedback",
  "/offline",
  "/migration-helper",
];
for (const prefix of ["", "/en"]) {
  for (const pathname of privatePaths) {
    const path = `${prefix}${pathname}`;
    assert.ok(!entries.some((entry) => entry.url === `${origin}${path}`));
    const response = await request(path);
    const head = (await response.text()).split("</head>")[0];
    const robots = tags(head, "meta")
      .filter((tag) => ["robots", "googlebot"].includes(tag.name))
      .map((tag) => tag.content)
      .join(" ");
    assert.match(
      `${robots} ${response.headers.get("x-robots-tag") ?? ""}`,
      /noindex/i,
      `${path}: noindex`,
    );
    assert.ok(
      !tags(head, "link").some(
        (tag) => tag.rel === "canonical" || tag.hreflang,
      ),
      `${path}: no public canonical or language alternates`,
    );
  }
}
const robots = await (await request("/robots.txt")).text();
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
console.log(
  `SEO runtime passed: ${entries.length} public URLs, ${privatePaths.length * 2} private routes, ${articles} articles, ${checkedImages.size} images.`,
);
