import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Run from apps/web, against the production server or inside its container.
const baseUrl = new URL(process.env.WEB_RUNTIME_URL ?? "http://127.0.0.1:3000");
assert.ok(
  baseUrl.protocol === "http:" &&
    ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
  "Runtime verification must use a local server",
);
const workspaceRoot = resolve("../..");
const requireWeb = createRequire(resolve("package.json"));
const lock = JSON.parse(
  await readFile(resolve(workspaceRoot, "package-lock.json"), "utf8"),
);
async function installedVersion(name) {
  let directory = dirname(requireWeb.resolve(name));
  while (true) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "package.json"), "utf8"),
      );
      if (manifest.name === name) return manifest.version;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    assert.notEqual(
      parent,
      directory,
      `Cannot locate ${name} package metadata`,
    );
    directory = parent;
  }
}

for (const name of ["next", "react", "react-dom", "sharp", "next-intl"]) {
  const expected =
    lock.packages[`apps/web/node_modules/${name}`] ??
    lock.packages[`node_modules/${name}`];
  assert.ok(expected, `${name} is locked for the web workspace`);
  const actual = await installedVersion(name);
  assert.equal(actual, expected.version, `${name} matches lockfile`);
  console.log(`${name}: ${actual}`);
}
const sharp = requireWeb("sharp");

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response;
}

const deadline = Date.now() + 60_000;
while (true) {
  try {
    await request("/en/about");
    break;
  } catch (error) {
    if (Date.now() >= deadline) throw error;
    await delay(500);
  }
}
for (const [path, locale] of [
  ["/about", "ko"],
  ["/en/about", "en"],
]) {
  const html = await (await request(path)).text();
  assert.match(html, new RegExp(`<html[^>]*lang="${locale}"`));
  const stylesheet = html.match(/href="([^" ]*\/_next\/static\/[^" ]+\.css)"/);
  assert.ok(stylesheet, `${path} includes built styles`);
  const styles = await request(stylesheet[1]);
  assert.match(styles.headers.get("content-type") ?? "", /text\/css/);
  assert.ok((await styles.text()).length > 1000, "Built styles are present");
  console.log(`${path}: ${locale} HTML and built styles OK`);
}

async function render(name, payload) {
  const response = await request("/og/share-card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
  const png = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1920);
  assert.ok(png.length > 10_000, `${name} is not an empty image`);
  if (process.env.WEB_RUNTIME_ARTIFACT_DIR) {
    await mkdir(process.env.WEB_RUNTIME_ARTIFACT_DIR, { recursive: true });
    await writeFile(
      resolve(process.env.WEB_RUNTIME_ARTIFACT_DIR, `${name}.png`),
      png,
    );
  }
  console.log(`${name}: 1080x1920 PNG (${png.length} bytes)`);
  return createHash("sha256").update(png).digest("hex");
}

const log = {
  title: "공유 카드 검증",
  titleType: "movie",
  statusLabel: "봤어요",
  date: "2026-10-07",
  showProfileSignature: true,
  profileNickname: "ottline",
  watermark: "ottline.app",
  theme: "default",
};
const plainLog = await render("log-without-avatar", log);
const avatarLog = await render("log-with-avatar", {
  ...log,
  profileAvatarUrl: "/avatars/clean-bg/avatar-cinema-keeper.webp",
});
assert.notEqual(avatarLog, plainLog, "sharp renders the local WebP avatar");

const recap = {
  cardType: "recap",
  recapKind: "weekly",
  title: "이번 주의 기록",
  subtitle: "Weekly report",
  stats: [{ label: "기록", value: "2" }],
  footer: "ottline.app",
  watermark: "ottline.app",
  theme: "default",
};
const posterItem = { title: "Dune: Part Two", titleType: "movie", count: 2 };
const fallback = await render("weekly-title-fallback", {
  ...recap,
  posterItems: [posterItem],
});
const poster = await render("weekly-with-poster", {
  ...recap,
  posterItems: [
    {
      ...posterItem,
      posterUrl: new URL("/share-cards/sample-video-poster.svg", baseUrl).href,
    },
  ],
});
assert.notEqual(poster, fallback, "The weekly card includes its poster");
console.log("Production runtime verification passed");
