import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(webRoot, "public");
const outputRoot = path.join(publicRoot, "chatgpt-directory");
const widgetTemplatePath = path.join(publicRoot, "chatgpt-widget-v2.html");
const browsersPath = path.resolve(webRoot, "..", ".playwright-browsers");
const previewRuntimePath = path.join(
  "/tmp",
  "ottline-chatgpt-widget-preview.html",
);

process.env.PLAYWRIGHT_BROWSERS_PATH ??= browsersPath;

const viewport = {
  width: 706,
  height: 860,
};

const states = ["recent", "movies", "series"];

const widgetConfig = {
  defaultLocale: "en",
  tools: {
    listRecentLogs: "timeline.list_recent_logs",
  },
  i18n: {
    en: {
      metaTitle: "ottline ChatGPT widget",
      hero: {
        eyebrow: "ottline for ChatGPT",
        title: "Bring your timeline into the conversation",
        copy: "Load your ottline history so ChatGPT can read your recent watches and notes before it helps you analyze or pick what to watch next.",
      },
      status: {
        signedOut:
          "Your ottline history is ready to connect. Ask for private timeline data and ChatGPT will open the sign-in flow when needed.",
        authRequired:
          "Connect your ottline account to load private history. After that, run the same request again.",
      },
      actions: {
        loadTimeline: "Load recent logs",
        loadMovies: "Recent movies",
        loadSeries: "Recent series",
      },
      timeline: {
        title: "Recent logs",
        copy: "Load recent watches and notes here, then ask ChatGPT to analyze your taste or recommend what to watch next.",
        empty:
          "Add recent logs on ottline.app first, then connect your account to see them here.",
      },
      enums: {
        type: {
          movie: "Movie",
          series: "Series",
          book: "Book",
        },
        status: {
          DONE: "Watched",
          IN_PROGRESS: "In progress",
          WISHLIST: "Want to watch",
        },
        place: {
          HOME: "Home",
          THEATER: "Theater",
          TRANSIT: "Transit",
          CAFE: "Cafe",
          OFFICE: "Office",
          LIBRARY: "Library",
          BOOKSTORE: "Bookstore",
          SCHOOL: "School",
          PARK: "Park",
          OUTDOOR: "Outdoor",
          ETC: "Other",
        },
        occasion: {
          ALONE: "Alone",
          DATE: "Date",
          FAMILY: "Family",
          FRIENDS: "Friends",
          BREAK: "Break",
          ETC: "Other",
        },
      },
    },
  },
};

const posterPalettes = {
  blue: ["#16397D", "#3B82F6", "#7DD3FC"],
  teal: ["#083A36", "#0F766E", "#5EEAD4"],
  amber: ["#8A3B07", "#F59E0B", "#FDE68A"],
  orange: ["#7C2D12", "#EA580C", "#FDBA74"],
  coral: ["#9A3412", "#F97316", "#FED7AA"],
  red: ["#7F1D1D", "#DC2626", "#FCA5A5"],
  green: ["#064E3B", "#0F766E", "#99F6E4"],
  mint: ["#115E59", "#14B8A6", "#5EEAD4"],
  cyan: ["#164E63", "#0891B2", "#A5F3FC"],
};

function svgDataUri(source) {
  return `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
}

function makePosterUri(kind, colors) {
  const [dark, mid, light] = colors;
  const motifs = {
    orbit: `
      <ellipse cx="24" cy="92" rx="64" ry="18" fill="rgba(255,255,255,0.25)" />
      <ellipse cx="24" cy="94" rx="52" ry="12" fill="rgba(255,255,255,0.18)" />
      <circle cx="58" cy="30" r="20" fill="rgba(255,255,255,0.28)" />
      <circle cx="69" cy="42" r="12" fill="rgba(255,255,255,0.18)" />
    `,
    stripes: `
      <path d="M16 112L54 -4" stroke="rgba(255,255,255,0.18)" stroke-width="10" />
      <path d="M42 112L78 -4" stroke="rgba(255,255,255,0.14)" stroke-width="12" />
      <path d="M-8 112L22 16" stroke="rgba(255,255,255,0.18)" stroke-width="8" />
    `,
    grid: `
      <rect x="12" y="18" width="24" height="22" rx="6" fill="rgba(255,255,255,0.18)" />
      <rect x="44" y="18" width="24" height="22" rx="6" fill="rgba(255,255,255,0.22)" />
      <rect x="12" y="48" width="24" height="22" rx="6" fill="rgba(255,255,255,0.14)" />
      <rect x="44" y="48" width="24" height="22" rx="6" fill="rgba(255,255,255,0.18)" />
      <rect x="12" y="78" width="24" height="22" rx="6" fill="rgba(255,255,255,0.16)" />
      <rect x="44" y="78" width="24" height="22" rx="6" fill="rgba(255,255,255,0.1)" />
    `,
    wave: `
      <path d="M-10 82C8 66 22 60 38 64C56 68 70 80 90 74" stroke="rgba(255,255,255,0.34)" stroke-width="7" fill="none" stroke-linecap="round" />
      <path d="M-8 102C12 88 30 84 48 88C62 92 76 98 90 94" stroke="rgba(255,255,255,0.22)" stroke-width="6" fill="none" stroke-linecap="round" />
      <circle cx="62" cy="28" r="14" fill="rgba(255,255,255,0.16)" />
    `,
    signal: `
      <path d="M12 76L26 62L40 68L55 48L70 56" stroke="rgba(255,255,255,0.46)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="26" cy="62" r="6" fill="rgba(255,255,255,0.28)" />
      <circle cx="40" cy="68" r="6" fill="rgba(255,255,255,0.24)" />
      <circle cx="55" cy="48" r="6" fill="rgba(255,255,255,0.3)" />
      <circle cx="70" cy="56" r="6" fill="rgba(255,255,255,0.26)" />
      <rect x="12" y="18" width="58" height="10" rx="5" fill="rgba(255,255,255,0.14)" />
    `,
  };

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="92" viewBox="0 0 64 92">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="64" y2="92" gradientUnits="userSpaceOnUse">
          <stop stop-color="${dark}" />
          <stop offset="0.58" stop-color="${mid}" />
          <stop offset="1" stop-color="${light}" />
        </linearGradient>
        <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(16 12) rotate(47) scale(38 28)">
          <stop stop-color="rgba(255,255,255,0.12)" />
          <stop offset="1" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect width="64" height="92" rx="14" fill="url(#bg)" />
      <rect x="6" y="6" width="52" height="80" rx="12" fill="url(#glow)" />
      ${motifs[kind]}
    </svg>
  `);
}

function buildPreviewDatasets() {
  return {
    recent: [
      {
        title: {
          type: "movie",
          name: "Blue Hour",
          year: 2024,
          posterUrl: makePosterUri("orbit", posterPalettes.blue),
        },
        status: "DONE",
        note: "Late-night rewatch, still sharper than memory.",
        ott: "Stream+",
        watchedAt: "2026-04-18T20:10:00Z",
        place: "HOME",
        occasion: "ALONE",
      },
      {
        title: {
          type: "series",
          name: "Signal Room",
          year: 2025,
          posterUrl: makePosterUri("stripes", posterPalettes.teal),
        },
        status: "IN_PROGRESS",
        note: "Season two opened with exactly the right tension.",
        ott: "Luma+",
        watchedAt: "2026-04-17T12:00:00Z",
        place: "HOME",
        occasion: "BREAK",
      },
      {
        title: {
          type: "book",
          name: "Paper Echo",
          year: 2023,
          posterUrl: makePosterUri("grid", posterPalettes.amber),
        },
        status: "DONE",
        note: "Marked a few quiet lines worth carrying forward.",
        ott: "Reader",
        watchedAt: "2026-04-15T09:10:00Z",
        place: "CAFE",
        occasion: "ALONE",
      },
    ],
    movie: [
      {
        title: {
          type: "movie",
          name: "Afterglow",
          year: 2024,
          posterUrl: makePosterUri("orbit", posterPalettes.orange),
        },
        status: "DONE",
        note: "A restrained finish with just enough warmth.",
        ott: "Stream+",
        watchedAt: "2026-04-18T18:00:00Z",
        place: "HOME",
        occasion: "ALONE",
      },
      {
        title: {
          type: "movie",
          name: "Sunline",
          year: 2022,
          posterUrl: makePosterUri("wave", posterPalettes.coral),
        },
        status: "DONE",
        note: "Best when the camera stays still and waits.",
        ott: "Cinebox",
        watchedAt: "2026-04-16T11:00:00Z",
        place: "THEATER",
        occasion: "ALONE",
      },
      {
        title: {
          type: "movie",
          name: "Harbor Night",
          year: 2021,
          posterUrl: makePosterUri("grid", posterPalettes.red),
        },
        status: "DONE",
        note: "Clean suspense, no wasted scenes anywhere.",
        ott: "Night+",
        watchedAt: "2026-04-14T15:40:00Z",
        place: "HOME",
        occasion: "FRIENDS",
      },
    ],
    series: [
      {
        title: {
          type: "series",
          name: "Quiet Static",
          year: 2025,
          posterUrl: makePosterUri("signal", posterPalettes.green),
        },
        status: "IN_PROGRESS",
        note: "Episode four finally tied the colder threads together.",
        ott: "Pulse+",
        watchedAt: "2026-04-18T07:30:00Z",
        place: "HOME",
        occasion: "ALONE",
      },
      {
        title: {
          type: "series",
          name: "North Relay",
          year: 2024,
          posterUrl: makePosterUri("stripes", posterPalettes.mint),
        },
        status: "IN_PROGRESS",
        note: "The ensemble clicked once the pace settled down.",
        ott: "Luma+",
        watchedAt: "2026-04-17T08:30:00Z",
        place: "HOME",
        occasion: "BREAK",
      },
      {
        title: {
          type: "series",
          name: "Delta Frame",
          year: 2023,
          posterUrl: makePosterUri("wave", posterPalettes.cyan),
        },
        status: "DONE",
        note: "A compact finale with a smart final reveal.",
        ott: "Frame+",
        watchedAt: "2026-04-13T21:15:00Z",
        place: "HOME",
        occasion: "FRIENDS",
      },
    ],
  };
}

function buildMockBridgeScript() {
  const preview = {
    datasets: buildPreviewDatasets(),
    messages: {
      recent: "Loaded your recent logs.",
      movie: "Loaded your recent movie logs.",
      series: "Loaded your recent series logs.",
      empty: "No recent logs found.",
    },
  };

  return `
    <script>
      window.__OTTLINE_PREVIEW__ = ${JSON.stringify(preview).replace(/</g, "\\u003c")};
      window.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
          return;
        }

        if (message.method === "ui/initialize") {
          window.postMessage({
            jsonrpc: "2.0",
            id: message.id,
            result: {},
          }, "*");
          return;
        }

        if (message.method !== "tools/call") {
          return;
        }

        const args = message.params?.arguments ?? {};
        const type = args.type === "movie" || args.type === "series" ? args.type : "recent";
        const items = window.__OTTLINE_PREVIEW__.datasets[type].slice(0, args.limit ?? 20);
        const text = items.length
          ? window.__OTTLINE_PREVIEW__.messages[type]
          : window.__OTTLINE_PREVIEW__.messages.empty;
        const result = {
          content: [{ type: "text", text }],
          structuredContent: {
            mode: "oauth",
            recentLogs: items,
          },
        };

        window.postMessage({
          jsonrpc: "2.0",
          id: message.id,
          result,
        }, "*");

        queueMicrotask(() => {
          window.postMessage({
            jsonrpc: "2.0",
            method: "ui/notifications/tool-result",
            params: result,
          }, "*");
        });
      }, { passive: true });
    </script>
  `;
}

async function writePreviewRuntimeFile() {
  const template = await fs.readFile(widgetTemplatePath, "utf8");
  const previewHtml = template
    .replace(
      "__OTTLINE_CHATGPT_CONFIG__",
      JSON.stringify(widgetConfig).replace(/</g, "\\u003c"),
    )
    .replace(
      '<script type="module">',
      `${buildMockBridgeScript()}\n<script type="module">`,
    );
  await fs.writeFile(previewRuntimePath, previewHtml, "utf8");
}

async function ensureOutputDir() {
  await fs.mkdir(outputRoot, { recursive: true });
}

async function buildScreenshots() {
  await ensureOutputDir();
  await writePreviewRuntimeFile();
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      colorScheme: "light",
      locale: "en-US",
    });

    const page = await context.newPage();

    for (const state of states) {
      await page.goto(pathToFileURL(previewRuntimePath).href, {
        waitUntil: "load",
      });

      await page.waitForSelector("#load-timeline");
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const actionSelector =
        state === "movies"
          ? "#load-movies"
          : state === "series"
            ? "#load-series"
            : "#load-timeline";
      await page.click(actionSelector);
      const expectedMessage =
        state === "movies"
          ? "Loaded your recent movie logs."
          : state === "series"
            ? "Loaded your recent series logs."
            : "Loaded your recent logs.";
      await page.waitForFunction(
        (message) => document.getElementById("status")?.textContent === message,
        expectedMessage,
      );
      await page.waitForTimeout(120);

      const retinaPath = path.join(
        outputRoot,
        `screenshot-${state}-1412x1720@2x.png`,
      );
      const basePath = path.join(outputRoot, `screenshot-${state}-706x860.png`);

      await page.screenshot({
        path: retinaPath,
        type: "png",
      });

      await sharp(retinaPath)
        .resize(viewport.width, viewport.height)
        .png({
          compressionLevel: 9,
          effort: 10,
        })
        .toFile(basePath);

      console.log(path.relative(webRoot, retinaPath));
      console.log(path.relative(webRoot, basePath));
    }

    await context.close();
  } finally {
    await browser.close();
    await fs.rm(previewRuntimePath, { force: true });
  }
}

buildScreenshots().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
