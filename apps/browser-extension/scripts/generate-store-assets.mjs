import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptsRoot, "..");
const assetsRoot = path.join(extensionRoot, "store-assets");

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadMessages(locale) {
  return JSON.parse(
    await readFile(
      path.join(extensionRoot, "_locales", locale, "messages.json"),
      "utf8",
    ),
  );
}

async function capturePopup(browser, locale) {
  const messages = await loadMessages(locale);
  const page = await browser.newPage({
    viewport: { width: 360, height: 520 },
    deviceScaleFactor: 2,
  });

  await page.addInitScript(
    ({ locale: nextLocale, messages: nextMessages }) => {
      const renderMessage = (key, substitutions = []) => {
        const resource = nextMessages[key];
        if (!resource) return "";
        const values = Array.isArray(substitutions)
          ? substitutions
          : [substitutions];

        return resource.message.replace(/\$([A-Z_]+)\$/g, (token, name) => {
          const placeholder = resource.placeholders?.[name.toLowerCase()];
          if (!placeholder) return token;
          const match = /^\$(\d+)$/.exec(placeholder.content);
          return match ? (values[Number(match[1]) - 1] ?? "") : token;
        });
      };

      globalThis.chrome = {
        i18n: {
          getMessage: renderMessage,
          getUILanguage: () => (nextLocale === "ko" ? "ko-KR" : "en-US"),
        },
        tabs: {
          query: async () => [
            {
              id: 1,
              url: "https://example.com/title/sample",
            },
          ],
          sendMessage: async () => ({
            ok: true,
            title: nextLocale === "ko" ? "오늘 본 영화" : "Tonight’s movie",
            contentType: "video",
            sourceSite: "store-preview",
            platform:
              nextLocale === "ko" ? "스트리밍 서비스" : "Streaming service",
            sourceUrl: "https://example.com/title/sample",
          }),
          create: async () => undefined,
        },
      };
    },
    { locale, messages },
  );

  await page.goto(pathToFileURL(path.join(extensionRoot, "popup.html")).href);
  await page.locator("#openButton:not([disabled])").waitFor();
  const screenshot = await page.locator("body").screenshot({ type: "png" });
  await page.close();
  return screenshot;
}

function marketingOverlay(locale) {
  const copy =
    locale === "ko"
      ? {
          headline1: "보고 있던 작품을",
          headline2: "바로 기록으로",
          description1: "제목과 플랫폼을 ottline QuickLog에",
          description2: "미리 채워드려요.",
          bullet1: "제목을 다시 입력하지 않아도 돼요",
          bullet2: "확인한 뒤 내가 직접 저장해요",
        }
      : {
          headline1: "From the title page",
          headline2: "to your timeline",
          description1: "Prefill the title and service",
          description2: "in ottline QuickLog.",
          bullet1: "Skip typing the title again",
          bullet2: "Review it, then save it yourself",
        };

  const text = Object.fromEntries(
    Object.entries(copy).map(([key, value]) => [key, escapeXml(value)]),
  );

  return Buffer.from(`
    <svg width="1280" height="800" viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#0F0F0F" flood-opacity="0.12"/>
        </filter>
      </defs>
      <rect width="1280" height="800" fill="#F8F6F2"/>
      <circle cx="112" cy="94" r="34" fill="#FFFFFF"/>
      <text x="166" y="91" fill="#1E4D8C" font-size="28" font-weight="800"
        letter-spacing="2" font-family="Noto Sans, Pretendard, sans-serif">OTTLINE</text>
      <text x="166" y="111" fill="#FF9933" font-size="11" font-weight="700"
        letter-spacing="1.6" font-family="Noto Sans, Pretendard, sans-serif">ON THE TIMELINE</text>
      <path d="M96 95h31" stroke="#1E4D8C" stroke-width="5" stroke-linecap="round"/>
      <circle cx="105" cy="95" r="7" fill="#FF9933"/>

      <text x="88" y="252" fill="#0F0F0F" font-size="52" font-weight="800"
        font-family="Noto Sans, Pretendard, sans-serif">${text.headline1}</text>
      <text x="88" y="318" fill="#1E4D8C" font-size="52" font-weight="800"
        font-family="Noto Sans, Pretendard, sans-serif">${text.headline2}</text>
      <rect x="88" y="350" width="72" height="6" rx="3" fill="#FF9933"/>

      <text x="88" y="411" fill="#4A4A4A" font-size="23" font-weight="500"
        font-family="Noto Sans, Pretendard, sans-serif">${text.description1}</text>
      <text x="88" y="446" fill="#4A4A4A" font-size="23" font-weight="500"
        font-family="Noto Sans, Pretendard, sans-serif">${text.description2}</text>

      <circle cx="104" cy="520" r="16" fill="#FFFFFF" stroke="#1E4D8C" stroke-width="2"/>
      <path d="M97 520l5 5 9-11" fill="none" stroke="#1E4D8C" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
      <text x="136" y="528" fill="#0F0F0F" font-size="20" font-weight="600"
        font-family="Noto Sans, Pretendard, sans-serif">${text.bullet1}</text>

      <circle cx="104" cy="577" r="16" fill="#FFFFFF" stroke="#1E4D8C" stroke-width="2"/>
      <path d="M97 577l5 5 9-11" fill="none" stroke="#1E4D8C" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
      <text x="136" y="585" fill="#0F0F0F" font-size="20" font-weight="600"
        font-family="Noto Sans, Pretendard, sans-serif">${text.bullet2}</text>

      <rect x="738" y="150" width="454" height="480" rx="8" fill="#FFFFFF" filter="url(#shadow)"/>
      <rect x="738" y="150" width="454" height="52" rx="8" fill="#F2F1EE"/>
      <rect x="738" y="194" width="454" height="8" fill="#F2F1EE"/>
      <circle cx="768" cy="176" r="6" fill="#D5D2CC"/>
      <circle cx="790" cy="176" r="6" fill="#D5D2CC"/>
      <circle cx="812" cy="176" r="6" fill="#D5D2CC"/>
      <rect x="842" y="164" width="318" height="24" rx="8" fill="#FFFFFF"/>
      <circle cx="858" cy="176" r="5" fill="#FF9933"/>
      <text x="873" y="181" fill="#6B6B6B" font-size="12"
        font-family="Noto Sans, Pretendard, sans-serif">ottline</text>
    </svg>
  `);
}

async function writeLocalizedScreenshot(browser, locale) {
  const popup = await capturePopup(browser, locale);
  const popupImage = sharp(popup);
  const metadata = await popupImage.metadata();
  const popupWidth = 360;
  const popupHeight = Math.round(
    (metadata.height / metadata.width) * popupWidth,
  );
  const resizedPopup = await popupImage
    .resize({ width: popupWidth })
    .png()
    .toBuffer();
  const outputDirectory = path.join(assetsRoot, locale);

  await mkdir(outputDirectory, { recursive: true });
  await sharp({
    create: {
      width: 1280,
      height: 800,
      channels: 4,
      background: "#F8F6F2",
    },
  })
    .composite([
      { input: marketingOverlay(locale), left: 0, top: 0 },
      {
        input: resizedPopup,
        left: 785,
        top: 226,
      },
    ])
    .png()
    .toFile(path.join(outputDirectory, "chrome-web-store-01.png"));

  if (popupHeight > 552) {
    throw new Error(`Popup is too tall for the store frame: ${popupHeight}px`);
  }
}

async function writePromotionalTiles() {
  const outputDirectory = path.join(assetsRoot, "global");
  await mkdir(outputDirectory, { recursive: true });

  const tile = (width, height, headlineSize) =>
    Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#1E4D8C"/>
        <circle cx="${Math.round(width * 0.82)}" cy="${Math.round(height * 0.23)}"
          r="${Math.round(height * 0.3)}" fill="#2B619F"/>
        <circle cx="${Math.round(width * 0.9)}" cy="${Math.round(height * 0.88)}"
          r="${Math.round(height * 0.42)}" fill="#173E72"/>
        <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.14)}"
          width="${Math.round(width * 0.34)}" height="${Math.round(height * 0.17)}"
          rx="8" fill="#F8F6F2"/>
        <text x="${Math.round(width * 0.105)}" y="${Math.round(height * 0.245)}"
          fill="#1E4D8C" font-size="${Math.round(headlineSize * 0.42)}" font-weight="800"
          letter-spacing="1.2" font-family="Noto Sans, Pretendard, sans-serif">OTTLINE</text>
        <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.42)}"
          width="${Math.round(width * 0.1)}" height="${Math.max(4, Math.round(height * 0.018))}"
          rx="3" fill="#FF9933"/>
        <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.62)}"
          fill="#FFFFFF" font-size="${headlineSize}" font-weight="800"
          font-family="Noto Sans, Pretendard, sans-serif">Streaming logs,</text>
        <text x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.8)}"
          fill="#FFFFFF" font-size="${headlineSize}" font-weight="800"
          font-family="Noto Sans, Pretendard, sans-serif">one click closer.</text>
      </svg>
    `);

  await sharp(tile(440, 280, 27))
    .png()
    .toFile(path.join(outputDirectory, "small-promo-tile-440x280.png"));
  await sharp(tile(1400, 560, 58))
    .png()
    .toFile(path.join(outputDirectory, "marquee-promo-tile-1400x560.png"));
}

const browser = await chromium.launch({ headless: true });
try {
  await writeLocalizedScreenshot(browser, "ko");
  await writeLocalizedScreenshot(browser, "en");
  await writePromotionalTiles();
} finally {
  await browser.close();
}
