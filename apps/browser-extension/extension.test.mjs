import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const extensionRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(extensionRoot, "..", "..");
const read = (...segments) =>
  readFileSync(path.join(extensionRoot, ...segments), "utf8");
const readJson = (...segments) => JSON.parse(read(...segments));

test("ships a localized Manifest V3 package at version 0.1.1", () => {
  const manifest = readJson("manifest.json");

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.1.1");
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_extensionName__");
  assert.equal(manifest.description, "__MSG_extensionDescription__");
  assert.equal(manifest.action.default_title, "__MSG_actionTitle__");
  assert.deepEqual(manifest.permissions, ["activeTab", "tabs"]);
});

test("keeps Korean and English extension messages complete and store-safe", () => {
  const ko = readJson("_locales", "ko", "messages.json");
  const en = readJson("_locales", "en", "messages.json");

  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
  assert.equal(ko.extensionName.message, "ottline - OTT 기록 도우미");
  assert.equal(en.extensionName.message, "ottline - Streaming Log Helper");

  for (const messages of [ko, en]) {
    assert.ok(messages.extensionName.message.length <= 75);
    assert.ok(messages.extensionDescription.message.length <= 132);
  }
});

test("routes Korean to the canonical root and English to the prefixed locale", () => {
  const context = { URL };
  vm.runInNewContext(read("popup-core.js"), context);
  const core = context.OttlineExtension;
  const payload = {
    title: "My Test Title",
    contentType: "video",
    sourceSite: "disneyplus",
    platformKey: "disney",
    platform: "디즈니플러스",
    sourceUrl: "https://www.disneyplus.com/en-gb/browse/entity-test",
  };

  assert.equal(core.normalizeLocale("ko-KR"), "ko");
  assert.equal(core.normalizeLocale("en-US"), "en");
  assert.equal(core.appBaseUrl("ko"), "https://ottline.app/");
  assert.equal(core.appBaseUrl("en"), "https://ottline.app/en");

  const koUrl = new URL(core.buildTargetUrl(payload, "ko-KR"));
  const enUrl = new URL(core.buildTargetUrl(payload, "en-US"));

  assert.equal(koUrl.pathname, "/");
  assert.equal(enUrl.pathname, "/en");
  assert.equal(enUrl.searchParams.get("capture_title"), "My Test Title");
  assert.equal(enUrl.searchParams.get("capture_platform_key"), "disney");
  assert.equal(enUrl.searchParams.get("capture_source_site"), "disneyplus");
  assert.equal(enUrl.searchParams.get("quick_focus"), "1");
});

test("localizes the popup without hardcoded Korean UI or store-rejected brand lists", () => {
  const html = read("popup.html");
  const script = read("popup.js");
  const css = read("popup.css");

  assert.match(html, /data-i18n="popupTitle"/);
  assert.match(html, /popup-core\.js[\s\S]+popup\.js/);
  assert.match(script, /chrome\.i18n\.getUILanguage/);
  assert.doesNotMatch(script, /ottline\.app\/ko/);
  assert.doesNotMatch(
    script,
    /Netflix,\s*Disney\+,\s*TVING,\s*wavve,\s*Coupang Play,\s*WATCHA/,
  );
  assert.match(css, /background:\s*#f8f6f2/i);
  assert.match(css, /background:\s*#ff9933/i);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});

test("sends stable platform keys that the web QuickLog understands", () => {
  const content = read("content.js");

  for (const key of [
    "netflix",
    "disney",
    "tving",
    "wavve",
    "coupang",
    "watcha",
  ]) {
    assert.match(content, new RegExp(`platformKey: "${key}"`));
  }
  assert.match(content, /platformKey:\s*site\.platformKey/);
});

test("packages popup-core and validates the extension before upload", () => {
  const workflow = readFileSync(
    path.join(
      repositoryRoot,
      ".github",
      "workflows",
      "browser-extension-package.yml",
    ),
    "utf8",
  );

  assert.match(
    workflow,
    /node --test apps\/browser-extension\/extension\.test\.mjs/,
  );
  assert.match(workflow, /popup-core\.js/);
});

test("includes localized full-resolution Chrome Web Store screenshots", () => {
  for (const locale of ["ko", "en"]) {
    const png = readFileSync(
      path.join(
        extensionRoot,
        "store-assets",
        locale,
        "chrome-web-store-01.png",
      ),
    );

    assert.equal(png.toString("ascii", 1, 4), "PNG");
    assert.equal(png.readUInt32BE(16), 1280);
    assert.equal(png.readUInt32BE(20), 800);
  }
});
