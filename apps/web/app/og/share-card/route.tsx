import { ImageResponse } from "next/og";
import fs from "node:fs/promises";
import { getAverageColor } from "fast-average-color-node";

export const runtime = "nodejs";

type ShareCardPayload = {
  title: string;
  titleType?: "movie" | "series" | "book";
  format?: "story" | "feed";
  note?: string | null;
  statusLabel: string;
  ratingLabel?: string | null;
  ratingValue?: number | null;
  date: string;
  posterUrl?: string | null;
  watermark: string;
  theme: "default" | "retro";
};

async function renderShareCard(body: ShareCardPayload) {
  try {
    const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }> = [];

    // Try multiple paths for fonts (System path and Project path)
    const fontPaths = [
      { name: "NanumSquare", weight: 400 as const, paths: ["/usr/share/fonts/truetype/nanum/NanumSquareR.ttf", "./public/fonts/NanumSquareR.ttf"] },
      { name: "NanumSquare", weight: 700 as const, paths: ["/usr/share/fonts/truetype/nanum/NanumSquareB.ttf", "./public/fonts/NanumSquareB.ttf"] },
      { name: "Galmuri11", weight: 400 as const, paths: ["./public/fonts/Galmuri11.ttf"] },
      { name: "Galmuri11", weight: 700 as const, paths: ["./public/fonts/Galmuri11-Bold.ttf"] }
    ];

    for (const fontInfo of fontPaths) {
      for (const path of fontInfo.paths) {
        try {
          const data = await fs.readFile(path);
          fonts.push({
            name: fontInfo.name,
            data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
            weight: fontInfo.weight,
            style: "normal"
          });
          break; // Use the first successful one
        } catch {
          continue;
        }
      }
    }

    const rawTitle = body.title ?? "";
    const isBook = body.titleType === "book";
    const format = body.format ?? "story";
    const isFeed = format === "feed";
    const scale = isFeed ? 0.8 : 1;
    const s = (value: number) => Math.round(value * scale);
    const width = 1080;
    const height = isFeed ? 1350 : 1920;
    const cleanedTitle = body.titleType === "book" ? stripBookSubtitle(rawTitle) : rawTitle;
    const title = clampText(cleanedTitle, 60);
    const formattedTitle = formatTitleForCard(title);
    const note = body.note
      ? clampText(normalizeNote(body.note, isBook ? 3 : 2), isBook ? 120 : 80)
      : null;
    let posterUrl = body.posterUrl ?? null;
    const watermark = body.watermark ?? "On the Timeline";
    const isRetro = body.theme === "retro";
    
    // Select font family based on theme
    const fontFamily = isRetro ? "Galmuri11, sans-serif" : "NanumSquare, sans-serif";

    let backgroundColor = isRetro ? "#f8f2e9" : "#0b0c10";
    let contentBgColor = isRetro ? "#fff6dd" : "#0b1224";

    if (posterUrl) {
      posterUrl = tmdbResize(posterUrl, "w780") ?? posterUrl;
      try {
        const res = await fetch(posterUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          const contentType = res.headers.get("content-type") || "image/jpeg";
          const finalPosterUrl = `data:${contentType};base64,${base64}`;

          // Extract color if not retro and using a real image
          if (!isRetro) {
            try {
              const colorData = await getAverageColor(buffer);
              
              if (colorData && colorData.value) {
                const [r, g, b] = colorData.value;
                // Darken the color significantly to ensure white text readability
                // Mix with black (70% black, 30% color) for the main background
                // Or just use it as a base for a gradient
                const darken = 0.2;
                const dr = Math.floor(r * darken);
                const dg = Math.floor(g * darken);
                const db = Math.floor(b * darken);
                
                // For content area, maybe slightly lighter but still dark
                const contentDarken = 0.25;
                const cr = Math.floor(r * contentDarken);
                const cg = Math.floor(g * contentDarken);
                const cb = Math.floor(b * contentDarken);

                backgroundColor = `rgb(${dr}, ${dg}, ${db})`;
                contentBgColor = `rgb(${cr}, ${cg}, ${cb})`;
              }
            } catch (e) {
                console.error("Color extraction failed:", e);
            }
          }

          posterUrl = finalPosterUrl;
        } else {
          posterUrl = null;
        }
      } catch {
        posterUrl = null;
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            backgroundColor,
            color: isRetro ? "#111827" : "#ffffff",
            fontFamily,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "70%",
              display: "flex",
              position: "relative",
              backgroundColor: isRetro ? "#f8f2e9" : backgroundColor, // Use same bg to blend
              overflow: "hidden",
            }}
          >
            {posterUrl ? (
              <img
                src={posterUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: isBook ? "center top" : "center 12%",
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "36%",
                display: "flex",
                background:
                  `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${contentBgColor} 100%)`, // Fade into content color
              }}
            />
          </div>

          <div
            style={{
              width: "100%",
              height: "30%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              padding: `${s(64)}px ${s(88)}px ${s(72)}px`,
              backgroundColor: contentBgColor,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: s(18),
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: s(isBook ? 64 : 84),
                  fontWeight: isRetro ? 700 : 700,
                  lineHeight: isBook ? 1.12 : 1.05,
                  letterSpacing: "-0.02em",
                  textTransform: isRetro ? "uppercase" : "none",
                  color: isRetro ? "#111827" : "#ffffff",
                  whiteSpace: "pre-wrap",
                }}
              >
                {formattedTitle}
              </div>

              {note ? (
                <div
                  style={{
                    display: "flex",
                    fontSize: s(isBook ? 40 : 38),
                    fontWeight: isRetro ? 700 : 500,
                    lineHeight: 1.3,
                    color: isRetro ? "#1f2937" : "#dbe4ff",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  “{note}”
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: s(12),
                  flexWrap: "wrap",
                  fontSize: s(isBook ? 26 : 28),
                  fontWeight: isRetro ? 700 : 600,
                  color: isRetro ? "#374151" : "#cbd5f5",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: s(8),
                    padding: `${s(10)}px ${s(16)}px`,
                    borderRadius: 999,
                    backgroundColor: isRetro ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.08)",
                    height: s(48),
                  }}
                >
                  <span>👀</span>
                  <span>{body.statusLabel}</span>
                </div>
                {body.ratingLabel ? (
                  <div
                    style={{
                    display: "flex",
                    alignItems: "center",
                    gap: s(8),
                    padding: `${s(10)}px ${s(16)}px`,
                    borderRadius: 999,
                    backgroundColor: isRetro ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.08)",
                    height: s(48),
                  }}
                >
                  <span>⭐</span>
                  <span>
                      {body.ratingLabel}
                      {typeof body.ratingValue === "number" ? ` ${body.ratingValue.toFixed(1)}` : ""}
                    </span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: s(8),
                    padding: `${s(10)}px ${s(16)}px`,
                    borderRadius: 999,
                    backgroundColor: isRetro ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.08)",
                    height: s(48),
                  }}
                >
                  <span>🗓</span>
                  <span>{body.date}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              bottom: s(64),
              left: s(88),
              display: "flex",
              fontSize: s(26),
              fontWeight: isRetro ? 700 : 500,
              letterSpacing: isRetro ? "0.06em" : "0.02em",
              textTransform: isRetro ? "uppercase" : "none",
              color: isRetro ? "rgba(17,24,39,0.7)" : "rgba(255,255,255,0.75)",
            }}
          >
            {watermark}
          </div>
        </div>
      ),
      {
        width,
        height,
        fonts,
      }
    );
  } catch (error) {
    return new Response(`Share card error: ${error instanceof Error ? error.message : "unknown"}`, {
      status: 500,
    });
  }
}

function clampText(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function normalizeNote(text: string, maxLines = 2) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.slice(0, maxLines).join("\n");
}

function stripBookSubtitle(title: string) {
  const withoutParens = title
    .replace(/\s*[\(\[\{][^)\]\}]+[\)\]\}]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const colonIndex = withoutParens.search(/:\s+/);
  const dashIndex = withoutParens.search(/\s[-–—]\s+/);
  let cutIndex = -1;
  if (colonIndex !== -1) cutIndex = colonIndex;
  if (dashIndex !== -1) cutIndex = cutIndex === -1 ? dashIndex : Math.min(cutIndex, dashIndex);
  const trimmed = cutIndex === -1 ? withoutParens : withoutParens.slice(0, cutIndex).trim();
  return trimmed.length > 0 ? trimmed : title;
}

function formatTitleForCard(title: string) {
  const idx = title.indexOf(":");
  if (idx === -1) return title;
  const before = title.slice(0, idx + 1);
  const after = title.slice(idx + 1).trim();
  return `${before}\n${after}`;
}

function tmdbResize(url: string | null | undefined, size: string): string | undefined {
  if (!url) return url ?? undefined;
  const marker = "https://image.tmdb.org/t/p/";
  if (!url.startsWith(marker)) return url;
  const rest = url.slice(marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return url;
  return `${marker}${size}${rest.slice(slash)}`;
}

export async function POST(req: Request) {
  const body = (await req.json()) as ShareCardPayload;
  return renderShareCard(body);
}

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const sample = searchParams.get("sample");
  if (!sample) {
    return new Response("Missing sample parameter", { status: 400 });
  }
  if (sample !== "video" && sample !== "book") {
    return new Response("Unsupported sample", { status: 400 });
  }

  const isBookSample = sample === "book";
  const posterUrl = `${origin}/share-cards/${isBookSample ? "sample-book-poster.svg" : "sample-video-poster.svg"}`;

  const body: ShareCardPayload = {
    title: isBookSample ? "불편한 편의점" : "듄: 파트 두",
    titleType: isBookSample ? "book" : "movie",
    format: "story",
    note: isBookSample ? "퇴근 후 한 장씩" : "아이맥스로 다시 한 번",
    statusLabel: isBookSample ? "읽었어요" : "봤어요",
    ratingLabel: isBookSample ? "인생책" : "최고예요",
    ratingValue: 5,
    date: "2026.01.31",
    posterUrl,
    watermark: "On the Timeline",
    theme: "default",
  };

  return renderShareCard(body);
}
