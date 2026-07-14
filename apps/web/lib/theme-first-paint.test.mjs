import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const layoutSource = readFileSync(
  path.join(webRoot, "app", "[locale]", "layout.tsx"),
  "utf8",
);
const themeContextSource = readFileSync(
  path.join(webRoot, "context", "ThemeContext.tsx"),
  "utf8",
);

test("runs the saved-theme initializer as the first authored head element", () => {
  const headIndex = layoutSource.indexOf("<head>");
  const themeScriptIndex = layoutSource.indexOf(
    "<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />",
  );
  const firstMetaIndex = layoutSource.indexOf("<meta", headIndex);

  assert.ok(headIndex >= 0);
  assert.ok(themeScriptIndex > headIndex);
  assert.ok(themeScriptIndex < firstMetaIndex);
  assert.doesNotMatch(layoutSource, /<Script id="theme-init"/);
});

test("paints the body with the resolved theme before DOMContentLoaded", () => {
  assert.match(layoutSource, /const applyBodyBackground = \(\) =>/);
  assert.match(
    layoutSource,
    /document\.addEventListener\("DOMContentLoaded", applyBodyBackground, \{ once: true \}\)/,
  );
});

test("declares light and dark browser chrome before the client theme loads", () => {
  assert.match(layoutSource, /colorScheme: "light dark"/);
  assert.match(
    layoutSource,
    /media: "\(prefers-color-scheme: light\)", color: "#F8F6F2"/,
  );
  assert.match(
    layoutSource,
    /media: "\(prefers-color-scheme: dark\)", color: "#15120F"/,
  );
});

test("keeps every emitted theme-color meta aligned with the saved app theme", () => {
  assert.match(
    layoutSource,
    /querySelectorAll\('meta\[name="theme-color"\]'\)/,
  );
  assert.match(
    themeContextSource,
    /querySelectorAll<HTMLMetaElement>\('meta\[name="theme-color"\]'\)/,
  );
});
