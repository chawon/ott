import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "apps/web/public/brand/v2");
const faviconOnly = process.argv.includes("--favicon-only");
const require = createRequire(path.join(root, "apps/web/package.json"));
const sharp = require("sharp");
const typographyFile = path.join(output, "typography-outlines.json");

// Optional, isolated one-time extraction. Normal generation only reads the fixed
// paths below and never needs fontkit/wawoff2 in the project dependency graph.
const extractIndex = process.argv.indexOf("--extract-typography");
if (extractIndex !== -1) {
  const toolRoot = process.argv[extractIndex + 1];
  if (!toolRoot) throw new Error("Pass the temporary font tool directory");
  const fontRequire = createRequire(path.resolve(toolRoot, "package.json"));
  const fontkit = fontRequire("fontkit");
  const wawoff2 = fontRequire("wawoff2");
  const fontSource = await readFile(
    path.join(root, "apps/web/public/fonts/PretendardVariable.woff2"),
  );
  const font = fontkit.create(
    Buffer.from(await wawoff2.decompress(fontSource)),
  );
  const capture = (text, weight, fontSize, letterSpacing, lineHeight) => {
    const instance = font.getVariation({ wght: weight });
    const run = instance.layout(text);
    const scale = fontSize / instance.unitsPerEm;
    let cursor = 0;
    const glyphs = run.glyphs.map((glyph, i) => {
      const position = run.positions[i];
      const x = (cursor + position.xOffset) * scale + i * letterSpacing;
      cursor += position.xAdvance;
      return { d: glyph.path.toSVG(), x, y: -position.yOffset * scale };
    });
    return {
      text,
      weight,
      fontSize,
      letterSpacing,
      lineHeight,
      scale,
      baseline:
        (lineHeight - (font.ascent - font.descent) * scale) / 2 +
        font.ascent * scale,
      advanceWidth: cursor * scale + text.length * letterSpacing,
      glyphs,
    };
  };
  const typography = {
    schema: "ottline.brand-typography/v1",
    source: {
      path: "apps/web/public/fonts/PretendardVariable.woff2",
      sha256: createHash("sha256").update(fontSource).digest("hex"),
      family: font.familyName,
      version: font.version,
      copyright: font.copyright,
      upstream: "https://github.com/orioncactus/pretendard",
      license: "SIL Open Font License 1.1",
    },
    tools: {
      fontkit: JSON.parse(
        await readFile(
          path.resolve(toolRoot, "node_modules/fontkit/package.json"),
          "utf8",
        ),
      ).version,
      wawoff2: JSON.parse(
        await readFile(
          path.resolve(toolRoot, "node_modules/wawoff2/package.json"),
          "utf8",
        ),
      ).version,
    },
    metrics: {
      unitsPerEm: font.unitsPerEm,
      ascent: font.ascent,
      descent: font.descent,
    },
    wordmark: capture("ottline", 700, 30, -0.75, 36),
    tagline: capture("ON THE TIMELINE", 600, 9, 0.9, 9),
    layout: { symbolSize: 40, gap: 8, height: 48 },
  };
  await mkdir(output, { recursive: true });
  await writeFile(typographyFile, `${JSON.stringify(typography, null, 2)}\n`);
}
const typography = JSON.parse(await readFile(typographyFile, "utf8"));
const currentFontHash = createHash("sha256")
  .update(await readFile(path.join(root, typography.source.path)))
  .digest("hex");
if (currentFontHash !== typography.source.sha256)
  throw new Error("Re-extract typography for the current Pretendard font");
const wordmarkWidth = Math.ceil(typography.wordmark.advanceWidth);
const lockupWidth =
  Math.ceil(
    (typography.layout.symbolSize +
      typography.layout.gap +
      Math.max(
        typography.wordmark.advanceWidth,
        typography.tagline.advanceWidth,
      )) *
      1000,
  ) / 1000;
const lockupHeight = typography.layout.height;
const letteringHeight =
  typography.wordmark.lineHeight + typography.tagline.lineHeight;
const letteringY = (lockupHeight - letteringHeight) / 2;

const palette = {
  navy: "#1E4D8C",
  cream: "#F8F6F2",
  orange: "#FF9933",
  ink: "#0F0F0F",
  gray: "#4A4A4A",
  line: "#ECEBE9",
};
const aBook =
  "M14 34V28C14 22.477 18.477 18 24 18C34 18 41.5 21.8 48 27C55.8 21.8 65.5 18 77 18C82.523 18 87 22.477 87 28V64C87 69.523 82.523 74 77 74C66.5 74 57.2 76.9 51.5 81";
const aPlay = "M15 49L36.5 62.75L15 76.5Z";
const markA = (color = palette.navy) =>
  `<g fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="${aBook}"/><path d="${aPlay}"/></g>`;
// A continuous time path folds into a bookmark; the play aperture remains open.
const markB = (color = palette.navy) =>
  `<path d="M69 20C62.8 16.1 55.5 14 48 14C28.118 14 12 30.118 12 50C12 69.882 28.118 86 48 86C67.882 86 84 69.882 84 50V34C84 29.582 80.418 26 76 26H63V62L49 53L35 62V29" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M45 35L58 43L45 51Z" fill="${color}"/>`;
const outlinedText = (run, color) =>
  `<g fill="${color}" transform="translate(0 ${run.baseline})">${run.glyphs.map((glyph) => `<path d="${glyph.d}" transform="translate(${glyph.x} ${glyph.y}) scale(${run.scale} ${-run.scale})"/>`).join("")}</g>`;
const wordmark = (color = palette.navy) =>
  outlinedText(typography.wordmark, color);
const tagline = (color = palette.orange) =>
  outlinedText(typography.tagline, color);

const svg = (viewBox, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;
const appForeground = (color = palette.navy) =>
  `<g transform="translate(512 512) scale(8.35) translate(-50 -49.5)">${markA(color)}</g>`;
const appA = `<rect width="1024" height="1024" fill="${palette.cream}"/>${appForeground()}`;
const appB = `<rect width="1024" height="1024" fill="${palette.cream}"/><g transform="translate(512 512) scale(8.2) translate(-48 -50)">${markB()}</g>`;
const lockup = (color = palette.navy) =>
  `<g transform="translate(0 ${(lockupHeight - typography.layout.symbolSize) / 2}) scale(${typography.layout.symbolSize / 96})">${markA(color)}</g><g transform="translate(${typography.layout.symbolSize + typography.layout.gap} ${letteringY})">${wordmark(color)}<g transform="translate(0 ${typography.wordmark.lineHeight})">${tagline()}</g></g>`;
const adaptiveForeground = (color = palette.navy) =>
  `<g transform="translate(54 54) scale(.677) translate(-50 -49.5)">${markA(color)}</g>`;
const favicon = `<style>svg{color:${palette.navy}}@media(prefers-color-scheme:dark){svg{color:${palette.cream}}}</style><g transform="translate(512 512) scale(10.3) translate(-50 -49.5)">${markA("currentColor")}</g>`;
const ogScale = 800 / lockupWidth;
const ogImage = `<rect width="1200" height="630" fill="${palette.cream}"/><g transform="translate(${(1200 - lockupWidth * ogScale) / 2} ${(630 - lockupHeight * ogScale) / 2}) scale(${ogScale})">${lockup()}</g>`;

await mkdir(output, { recursive: true });
const masters = {
  "mark.svg": svg("0 0 96 96", markA(), "ottline — 열린 책과 재생"),
  "mark-mono.svg": svg("0 0 96 96", markA("currentColor"), "ottline"),
  "mark-inverse.svg": svg("0 0 96 96", markA(palette.cream), "ottline"),
  "wordmark.svg": svg(
    `0 0 ${wordmarkWidth} ${typography.wordmark.lineHeight}`,
    wordmark(),
    "ottline",
  ),
  "wordmark-inverse.svg": svg(
    `0 0 ${wordmarkWidth} ${typography.wordmark.lineHeight}`,
    wordmark(palette.cream),
    "ottline",
  ),
  "lockup.svg": svg(
    `0 0 ${lockupWidth} ${lockupHeight}`,
    lockup(),
    "ottline — ON THE TIMELINE",
  ),
  "lockup-inverse.svg": svg(
    `0 0 ${lockupWidth} ${lockupHeight}`,
    lockup(palette.cream),
    "ottline — ON THE TIMELINE",
  ),
  "app-icon.svg": svg("0 0 1024 1024", appA, "ottline 앱 아이콘"),
  "app-foreground.svg": svg(
    "0 0 1024 1024",
    appForeground(),
    "ottline 앱 아이콘 전경",
  ),
  "app-background.svg": svg(
    "0 0 1024 1024",
    `<rect width="1024" height="1024" fill="${palette.cream}"/>`,
    "ottline 앱 아이콘 배경",
  ),
  "app-monochrome.svg": svg(
    "0 0 1024 1024",
    appForeground("#000000"),
    "ottline 단색 앱 아이콘",
  ),
  "adaptive-foreground.svg": svg(
    "0 0 108 108",
    adaptiveForeground(),
    "ottline Android 전경",
  ),
  "adaptive-background.svg": svg(
    "0 0 108 108",
    `<rect width="108" height="108" fill="${palette.cream}"/>`,
    "ottline Android 배경",
  ),
  "adaptive-monochrome.svg": svg(
    "0 0 108 108",
    adaptiveForeground("#000000"),
    "ottline Android 단색 전경",
  ),
  "favicon.svg": svg("0 0 1024 1024", favicon, "ottline"),
  "og-image.svg": svg("0 0 1200 630", ogImage, "ottline — ON THE TIMELINE"),
  "alternative-b-mark.svg": svg(
    "0 0 96 100",
    markB(),
    "ottline B — 시간과 책갈피",
  ),
  "alternative-b-app-icon.svg": svg(
    "0 0 1024 1024",
    appB,
    "ottline B 앱 아이콘",
  ),
};
for (const [name, contents] of Object.entries(masters)) {
  if (!faviconOnly || name === "favicon.svg")
    await writeFile(path.join(output, name), contents);
}

const previous = (
  await readFile(path.join(root, "apps/web/public/ottline_logo.png"))
).toString("base64");
const sizes = [16, 24, 32, 48, 64];
const boardIcon = (body, x, y, size, circle = false) =>
  `<g transform="translate(${x} ${y})"><defs><clipPath id="clip-${x}-${y}">${circle ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>` : `<rect width="${size}" height="${size}" rx="${size * 0.22}"/>`}</clipPath></defs><g clip-path="url(#clip-${x}-${y})"><g transform="scale(${size / 1024})">${body}</g></g></g>`;
const text = (x, y, copy, size = 16, weight = 400, color = palette.ink) =>
  `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${copy}</text>`;
const board = `<rect width="1200" height="920" fill="${palette.cream}"/>
  ${text(48, 58, "ottline / Identity evolution", 25, 600, palette.navy)}
  ${text(48, 87, "A keeps the familiar book + play. B explores a time path + bookmark.", 15, 400, palette.gray)}
  <path d="M48 112H1152" stroke="${palette.line}"/>
  ${text(48, 158, "CURRENT", 12, 600, palette.gray)}
  <image href="data:image/png;base64,${previous}" x="48" y="182" width="160" height="160"/>
  ${text(285, 158, "A / A page, a moment", 18, 600, palette.navy)}
  ${boardIcon(appA, 285, 182, 160)}
  <g transform="translate(485 208) scale(1.1)">${markA()}</g>
  <g transform="translate(650 195) scale(4.6)">${wordmark()}</g>
  <g transform="translate(655 337) scale(4.5)">${tagline()}</g>
  ${text(285, 390, "Real-size icon checks", 13, 600, palette.gray)}
  ${sizes.map((size, i) => `${boardIcon(appA, 285 + i * 116, 418, size)}${text(285 + i * 116, 506, `${size}px`, 12, 400, palette.gray)}`).join("")}
  ${boardIcon(appA, 916, 418, 88, true)}${boardIcon(appA, 1036, 418, 88)}
  ${text(916, 530, "System mask previews", 12, 400, palette.gray)}
  <rect x="48" y="570" width="530" height="124" rx="8" fill="#FFFFFF"/>
  <g transform="translate(72 584) scale(2)">${lockup()}</g>
  ${text(420, 643, "Cream / white", 12, 400, palette.gray)}
  <rect x="602" y="570" width="550" height="124" rx="8" fill="${palette.navy}"/>
  <g transform="translate(630 584) scale(2)">${lockup(palette.cream)}</g>
  ${text(1020, 643, "Dark", 12, 400, palette.cream)}
  ${text(48, 750, "B / Time path + bookmark", 18, 600, palette.navy)}
  ${boardIcon(appB, 48, 773, 100)}
  <g transform="translate(185 772) scale(1)">${markB()}</g>
  ${text(326, 810, "A different silhouette to compare with the continuity of A.", 16, 400, palette.gray)}
  ${text(326, 840, "Monochrome artwork / no text inside app icons / no baked icon corners.", 14, 400, palette.gray)}`;
const boardSvg = svg("0 0 1200 920", board, "ottline CI v2 comparison");
if (!faviconOnly) {
  await writeFile(path.join(output, "comparison-board.svg"), boardSvg);
  await sharp(Buffer.from(boardSvg))
    .resize(1200, 920)
    .png()
    .toFile(path.join(output, "comparison-board.png"));
}

const pngOptions = {
  compressionLevel: 9,
  adaptiveFiltering: false,
  palette: false,
};
const manifest = {
  schema: "ottline.brand-assets/v2",
  palette,
  typography: {
    file: "typography-outlines.json",
    source: typography.source,
    wordmark: {
      fontSize: typography.wordmark.fontSize,
      weight: typography.wordmark.weight,
      letterSpacing: typography.wordmark.letterSpacing,
      lineHeight: typography.wordmark.lineHeight,
      advanceWidth: typography.wordmark.advanceWidth,
    },
    tagline: {
      fontSize: typography.tagline.fontSize,
      weight: typography.tagline.weight,
      letterSpacing: typography.tagline.letterSpacing,
      lineHeight: typography.tagline.lineHeight,
      advanceWidth: typography.tagline.advanceWidth,
    },
  },
  dimensions: {
    wordmark: [wordmarkWidth, typography.wordmark.lineHeight],
    lockup: [lockupWidth, lockupHeight],
  },
  masters: Object.keys(masters),
  rasters: [],
  safety: {},
};
if (faviconOnly) {
  const previousManifest = JSON.parse(
    await readFile(path.join(output, "asset-manifest.json"), "utf8"),
  );
  Object.assign(manifest, previousManifest, {
    rasters: previousManifest.rasters.filter(
      ({ name }) => !name.startsWith("favicon-"),
    ),
  });
}
async function raster(name, master, width, opaque, height = width) {
  const pipeline = sharp(Buffer.from(masters[master])).resize(width, height, {
    fit: "fill",
  });
  const buffer = await (opaque
    ? pipeline.removeAlpha()
    : pipeline.ensureAlpha()
  )
    .png(pngOptions)
    .toBuffer();
  await writeFile(path.join(output, name), buffer);
  const metadata = await sharp(buffer).metadata();
  if (
    metadata.width !== width ||
    metadata.height !== height ||
    metadata.hasAlpha === opaque
  )
    throw new Error(`Unexpected PNG format for ${name}`);
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (const pixel of [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
  ]) {
    const rgba = [
      ...data.subarray(pixel * info.channels, pixel * info.channels + 4),
    ];
    if (
      opaque
        ? rgba.some((v, i) => v !== [248, 246, 242, 255][i])
        : rgba[3] !== 0
    )
      throw new Error(`Unexpected corner pixels in ${name}`);
  }
  manifest.rasters.push({
    name,
    master,
    width: metadata.width,
    height: metadata.height,
    alpha: metadata.hasAlpha,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
  return buffer;
}
if (!faviconOnly) {
  for (const size of [1024, 512, 192, 180, 128, 64, 48, 32, 16])
    await raster(`app-icon-${size}.png`, "app-icon.svg", size, true);
  await raster("app-foreground-1024.png", "app-foreground.svg", 1024, false);
  await raster("app-background-1024.png", "app-background.svg", 1024, true);
  await raster("app-monochrome-1024.png", "app-monochrome.svg", 1024, false);
  await raster("og-image.png", "og-image.svg", 1200, true, 630);
  for (const layer of ["foreground", "background", "monochrome"])
    await raster(
      `adaptive-${layer}-432.png`,
      `adaptive-${layer}.svg`,
      432,
      layer === "background",
    );
}
const faviconPngs = [];
const faviconSizes = [16, 24, 32, 48];
for (const size of faviconSizes)
  faviconPngs.push(
    await raster(`favicon-${size}.png`, "favicon.svg", size, false),
  );
// ICO stores deterministic PNG frames for modern browser size selection.
const icoDirectory = Buffer.alloc(6 + 16 * faviconPngs.length);
icoDirectory.writeUInt16LE(1, 2);
icoDirectory.writeUInt16LE(faviconPngs.length, 4);
let offset = icoDirectory.length;
for (const [i, bytes] of faviconPngs.entries()) {
  const entry = 6 + i * 16;
  icoDirectory[entry] = faviconSizes[i];
  icoDirectory[entry + 1] = faviconSizes[i];
  icoDirectory.writeUInt16LE(1, entry + 4);
  icoDirectory.writeUInt16LE(32, entry + 6);
  icoDirectory.writeUInt32LE(bytes.length, entry + 8);
  icoDirectory.writeUInt32LE(offset, entry + 12);
  offset += bytes.length;
}
const faviconIco = Buffer.concat([icoDirectory, ...faviconPngs]);
for (const destination of [
  path.join(output, "favicon.ico"),
  path.join(root, "apps/web/app/favicon.ico"),
  path.join(root, "apps/web/public/favicon.ico"),
])
  await writeFile(destination, faviconIco);

async function safety(master, size, unitSize, maxRadius) {
  const { data, info } = await sharp(Buffer.from(masters[master]))
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let radius = 0;
  let minX = size,
    minY = size,
    maxX = -1,
    maxY = -1;
  let cornerAlpha = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const a = data[(y * size + x) * info.channels + info.channels - 1];
      if (!a) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      radius = Math.max(
        radius,
        (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) * unitSize) / size,
      );
      if ((x === 0 || x === size - 1) && (y === 0 || y === size - 1))
        cornerAlpha = Math.max(cornerAlpha, a);
    }
  if (radius > maxRadius || cornerAlpha)
    throw new Error(
      `${master} escapes its safe circle: ${radius} > ${maxRadius}`,
    );
  return {
    canvas: unitSize,
    maxArtworkRadius: Number(radius.toFixed(4)),
    safeRadius: maxRadius,
    bounds: [minX, minY, maxX + 1, maxY + 1].map((v) =>
      Number(((v * unitSize) / size).toFixed(4)),
    ),
    cornerAlpha,
  };
}
if (!faviconOnly) {
  manifest.safety.pwa = await safety("app-foreground.svg", 1024, 1024, 409.6);
  manifest.safety.android = await safety(
    "adaptive-foreground.svg",
    1080,
    108,
    33,
  );
}
await writeFile(
  path.join(output, "asset-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  faviconOnly
    ? `Created transparent SVG, ${faviconSizes.length} RGBA PNG favicons and matching ICO copies in ${path.relative(root, output)}`
    : `Created ${Object.keys(masters).length} vector masters, ${manifest.rasters.length} PNG exports, ICO, and the comparison board in ${path.relative(root, output)}`,
);
console.log(JSON.stringify(manifest.safety, null, 2));
