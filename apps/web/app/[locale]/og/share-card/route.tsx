import fs from "node:fs/promises";
import path from "node:path";
import { getAverageColor } from "fast-average-color-node";
import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import sharp from "sharp";
import {
  avatarLayerStyle,
  isPersonaKey,
  SHARE_CARD_AVATAR_IMAGE_SCALE,
} from "@/lib/profile";
import type { PersonaKey } from "@/lib/types";

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
  showProfileSignature?: boolean;
  profileNickname?: string | null;
  profileAvatarUrl?: string | null;
  profilePersonaKey?: PersonaKey | string | null;
  watermark: string;
  theme: "default";
};

async function renderShareCard(body: ShareCardPayload) {
  try {
    const fonts: Array<{
      name: string;
      data: ArrayBuffer;
      weight: 400 | 700;
      style: "normal";
    }> = [];

    // Try multiple paths for fonts (System path and Project path)
    const fontPaths = [
      {
        name: "NanumSquare",
        weight: 400 as const,
        paths: [
          "/usr/share/fonts/truetype/nanum/NanumSquareR.ttf",
          "./public/fonts/NanumSquareR.ttf",
        ],
      },
      {
        name: "NanumSquare",
        weight: 700 as const,
        paths: [
          "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf",
          "./public/fonts/NanumSquareB.ttf",
        ],
      },
    ];

    for (const fontInfo of fontPaths) {
      for (const path of fontInfo.paths) {
        try {
          const data = await fs.readFile(path);
          fonts.push({
            name: fontInfo.name,
            data: data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength,
            ),
            weight: fontInfo.weight,
            style: "normal",
          });
          break; // Use the first successful one
        } catch {}
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
    const cleanedTitle =
      body.titleType === "book" ? stripBookSubtitle(rawTitle) : rawTitle;
    const title = clampText(cleanedTitle, 60);
    const formattedTitle = formatTitleForCard(title);
    const note = body.note
      ? clampText(normalizeNote(body.note, isBook ? 3 : 2), isBook ? 120 : 80)
      : null;
    let posterUrl = body.posterUrl ?? null;
    const watermark = body.watermark ?? "ottline.app";
    const profileNickname =
      body.showProfileSignature && body.profileNickname?.trim()
        ? clampText(body.profileNickname.trim(), 32)
        : null;
    const profilePersonaKey = isPersonaKey(body.profilePersonaKey)
      ? body.profilePersonaKey
      : null;
    const profileAvatarUrl = profileNickname
      ? await imageDataUrlForShareCard(body.profileAvatarUrl)
      : null;
    const profileAvatarPosition = avatarLayerStyle(profilePersonaKey);
    const sourceLabel = profileNickname ? "by ottline.app" : watermark;
    const signatureTextOffset = s(8);

    // Select font family
    const fontFamily = "NanumSquare, sans-serif";

    let backgroundColor = "#0b0c10";
    let contentBgColor = "#0b1224";

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

          // Extract color
          try {
            const colorData = await getAverageColor(buffer);

            if (colorData?.value) {
              const [r, g, b] = colorData.value;
              // Darken the color significantly to ensure white text readability
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

          posterUrl = finalPosterUrl;
        } else {
          posterUrl = null;
        }
      } catch {
        posterUrl = null;
      }
    }

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          backgroundColor,
          color: "#ffffff",
          fontFamily,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "70%",
            display: "flex",
            position: "relative",
            backgroundColor: backgroundColor,
            overflow: "hidden",
          }}
        >
          {posterUrl ? (
            <img
              src={posterUrl}
              alt=""
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
              background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${contentBgColor} 100%)`,
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
                fontWeight: 700,
                lineHeight: isBook ? 1.12 : 1.05,
                letterSpacing: "-0.02em",
                color: "#ffffff",
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
                  fontWeight: 500,
                  lineHeight: 1.3,
                  color: "#dbe4ff",
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
                fontWeight: 600,
                color: "#cbd5f5",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: s(8),
                  padding: `${s(10)}px ${s(16)}px`,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
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
                    backgroundColor: "rgba(255,255,255,0.08)",
                    height: s(48),
                  }}
                >
                  <span>⭐</span>
                  <span>
                    {body.ratingLabel}
                    {typeof body.ratingValue === "number"
                      ? ` ${body.ratingValue.toFixed(1)}`
                      : ""}
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
                  backgroundColor: "rgba(255,255,255,0.08)",
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
            alignItems: "center",
            gap: s(20),
            fontSize: s(26),
            fontWeight: 500,
            color: "rgba(255,255,255,0.75)",
          }}
        >
          {profileNickname ? (
            <>
              {profileAvatarUrl ? (
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    width: s(40),
                    height: s(40),
                    borderRadius: s(12),
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      display: "flex",
                      top: profileAvatarPosition.top,
                      left: profileAvatarPosition.left,
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <img
                      src={profileAvatarUrl}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        transform: `scale(${SHARE_CARD_AVATAR_IMAGE_SCALE})`,
                      }}
                    />
                  </div>
                </div>
              ) : null}
              <span
                style={{
                  color: "rgba(255,255,255,0.88)",
                  marginLeft: profileAvatarUrl ? s(4) : 0,
                  marginTop: signatureTextOffset,
                }}
              >
                {profileNickname}
              </span>
              <span
                style={{
                  color: "rgba(255,255,255,0.42)",
                  marginTop: signatureTextOffset,
                }}
              >
                ·
              </span>
              <span style={{ marginTop: signatureTextOffset }}>
                {sourceLabel}
              </span>
            </>
          ) : (
            sourceLabel
          )}
        </div>
      </div>,
      {
        width,
        height,
        fonts,
      },
    );
  } catch (error) {
    return new Response(
      `Share card error: ${error instanceof Error ? error.message : "unknown"}`,
      {
        status: 500,
      },
    );
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
    .replace(/\s*[([{][^)\]}]+[)\]}]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const colonIndex = withoutParens.search(/:\s+/);
  const dashIndex = withoutParens.search(/\s[-–—]\s+/);
  let cutIndex = -1;
  if (colonIndex !== -1) cutIndex = colonIndex;
  if (dashIndex !== -1)
    cutIndex = cutIndex === -1 ? dashIndex : Math.min(cutIndex, dashIndex);
  const trimmed =
    cutIndex === -1 ? withoutParens : withoutParens.slice(0, cutIndex).trim();
  return trimmed.length > 0 ? trimmed : title;
}

function formatTitleForCard(title: string) {
  const idx = title.indexOf(":");
  if (idx === -1) return title;
  const before = title.slice(0, idx + 1);
  const after = title.slice(idx + 1).trim();
  return `${before}\n${after}`;
}

function tmdbResize(
  url: string | null | undefined,
  size: string,
): string | undefined {
  if (!url) return url ?? undefined;
  const marker = "https://image.tmdb.org/t/p/";
  if (!url.startsWith(marker)) return url;
  const rest = url.slice(marker.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return url;
  return `${marker}${size}${rest.slice(slash)}`;
}

async function imageDataUrlForShareCard(
  src: string | null | undefined,
): Promise<string | null> {
  if (!src) return null;
  if (!src.startsWith("/")) return null;

  try {
    const publicPath = src.split(/[?#]/)[0];
    if (
      !publicPath.startsWith("/avatars/") ||
      publicPath.includes("..") ||
      publicPath.includes("\\")
    ) {
      return null;
    }

    const publicRoot = path.join(process.cwd(), "public");
    const filePath = path.join(publicRoot, publicPath.slice(1));
    if (!filePath.startsWith(publicRoot)) return null;

    const data = await fs.readFile(filePath);
    const png = await sharp(data).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as ShareCardPayload;
  return renderShareCard(body);
}

export async function GET(req: Request) {
  const { searchParams, origin, pathname } = new URL(req.url);
  const sample = searchParams.get("sample");
  if (!sample) {
    return new Response("Missing sample parameter", { status: 400 });
  }
  if (sample !== "video" && sample !== "book") {
    return new Response("Unsupported sample", { status: 400 });
  }

  // Extract locale from pathname (e.g., /en/og/share-card -> en)
  const locale = pathname.split("/")[1] || "ko";
  const isBookSample = sample === "book";
  const tQuick = await getTranslations({ locale, namespace: "QuickLogCard" });
  const posterUrl = `${origin}/share-cards/${isBookSample ? "sample-book-poster.svg" : "sample-video-poster.svg"}`;

  const body: ShareCardPayload = {
    title: isBookSample
      ? locale === "ko"
        ? "불편한 편의점"
        : "Uncomfortable Convenience Store"
      : locale === "ko"
        ? "듄: 파트 두"
        : "Dune: Part Two",
    titleType: isBookSample ? "book" : "movie",
    format: "story",
    note: isBookSample
      ? locale === "ko"
        ? "퇴근 후 한 장씩"
        : "One page after work"
      : locale === "ko"
        ? "아이맥스로 다시 한 번"
        : "Once more in IMAX",
    statusLabel: isBookSample
      ? tQuick("actionReadingComplete")
      : tQuick("actionWatched"),
    ratingLabel: isBookSample
      ? tQuick("ratingBestBook")
      : tQuick("ratingBestVideo"),
    ratingValue: 5,
    date: "2026.01.31",
    posterUrl,
    watermark: "ottline.app",
    theme: "default",
  };

  return renderShareCard(body);
}
