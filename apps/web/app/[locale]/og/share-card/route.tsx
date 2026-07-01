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
  cardType?: "log";
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

type RecapShareCardPayload = {
  cardType: "recap";
  recapKind: "weekly" | "monthly" | "half-year";
  format?: "story" | "feed";
  title: string;
  subtitle: string;
  periodLabel?: string;
  posterItems?: Array<{
    title: string;
    titleType?: string;
    posterUrl?: string | null;
    count?: number;
  }>;
  stats: Array<{ label: string; value: string }>;
  footer: string;
  watermark: string;
  theme: "default";
};

async function loadShareCardFonts() {
  const fonts: Array<{
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal";
  }> = [];

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
        break;
      } catch {}
    }
  }

  return fonts;
}

async function renderShareCard(body: ShareCardPayload) {
  try {
    const fonts = await loadShareCardFonts();

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

async function renderRecapShareCard(body: RecapShareCardPayload) {
  try {
    const fonts = await loadShareCardFonts();
    const format = body.format ?? "story";
    const isFeed = format === "feed";
    const scale = 1;
    const s = (value: number) => Math.round(value * scale);
    const width = 1080;
    const height = isFeed ? 1350 : 1920;
    const stats = (body.stats ?? []).slice(0, 4);
    const accent = "#ff9933";
    const posterItems = (body.posterItems ?? []).slice(0, 6);
    const posterImageUrls = await Promise.all(
      posterItems.map((item) => imageDataUrlForRemoteImage(item.posterUrl)),
    );
    const hasPosters = posterItems.length > 0;
    const heroHeight = isFeed ? 690 : 1040;
    const cardHeight = height;
    const mosaicSlots = [
      { left: 0, top: 0, width: 360, height: heroHeight * 0.55 },
      { left: 360, top: 0, width: 360, height: heroHeight * 0.45 },
      { left: 720, top: 0, width: 360, height: heroHeight * 0.58 },
      {
        left: 0,
        top: heroHeight * 0.55,
        width: 360,
        height: heroHeight * 0.45,
      },
      {
        left: 360,
        top: heroHeight * 0.45,
        width: 360,
        height: heroHeight * 0.55,
      },
      {
        left: 720,
        top: heroHeight * 0.58,
        width: 360,
        height: heroHeight * 0.42,
      },
    ];

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f8f6f2",
          color: "#0f0f0f",
          fontFamily: "NanumSquare, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "100%",
            height: s(heroHeight),
            display: "flex",
            position: "relative",
            overflow: "hidden",
            backgroundColor: hasPosters ? "#292724" : "#fef9ee",
          }}
        >
          {hasPosters
            ? posterItems.map((item, index) => {
                const slot = mosaicSlots[index] ?? mosaicSlots[0];
                const posterUrl = posterImageUrls[index];
                return (
                  <div
                    key={`${item.title}-${index}`}
                    style={{
                      position: "absolute",
                      display: "flex",
                      left: s(slot.left),
                      top: s(slot.top),
                      width: s(slot.width),
                      height: s(slot.height),
                      border: `${s(4)}px solid #f8f6f2`,
                      backgroundColor: index % 2 === 0 ? "#211f1c" : "#3a332b",
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
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          width: "100%",
                          height: "100%",
                          alignItems: "flex-end",
                          padding: s(28),
                          color: "#fff8ef",
                          fontSize: s(30),
                          lineHeight: 1.18,
                          fontWeight: 700,
                        }}
                      >
                        {clampText(item.title, 32)}
                      </div>
                    )}
                  </div>
                );
              })
            : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background:
                "linear-gradient(180deg, rgba(248,246,242,0) 76%, rgba(248,246,242,0.2) 100%)",
            }}
          />
        </div>

        <div
          style={{
            height: s(cardHeight - heroHeight),
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: `${s(isFeed ? 44 : 62)}px ${s(72)}px ${s(isFeed ? 48 : 62)}px`,
            backgroundColor: "#f8f6f2",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: s(isFeed ? 16 : 22),
            }}
          >
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: `${s(10)}px ${s(16)}px`,
                borderRadius: s(8),
                backgroundColor: "#ffffff",
                border: "1px solid #ecebe9",
                color: accent,
                fontSize: s(isFeed ? 22 : 26),
                fontWeight: 700,
              }}
            >
              {body.periodLabel ??
                (body.recapKind === "monthly" ? "MONTHLY" : "WEEKLY")}
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: s(930),
                fontSize: s(isFeed ? 64 : 84),
                lineHeight: 1.06,
                fontWeight: 700,
                color: "#0f0f0f",
                whiteSpace: "pre-wrap",
              }}
            >
              {clampText(body.title ?? "", 46)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: s(isFeed ? 30 : 38),
                lineHeight: 1.32,
                color: "#4a4a4a",
                whiteSpace: "pre-wrap",
              }}
            >
              {clampText(body.subtitle ?? "", 92)}
            </div>
            <div
              style={{
                display: "flex",
                gap: s(14),
              }}
            >
              {stats.slice(0, 3).map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    flex: 1,
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: s(isFeed ? 118 : 142),
                    padding: `${s(22)}px`,
                    borderRadius: s(8),
                    backgroundColor: "#ffffff",
                    border: "1px solid #ecebe9",
                  }}
                >
                  <span style={{ fontSize: s(22), color: "#4a4a4a" }}>
                    {clampText(stat.label, 16)}
                  </span>
                  <span
                    style={{
                      fontSize: s(42),
                      lineHeight: 1.1,
                      fontWeight: 700,
                      color: "#0f0f0f",
                    }}
                  >
                    {clampText(stat.value, 14)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: s(24),
              paddingTop: s(18),
              borderTop: "1px solid #ecebe9",
              fontSize: s(27),
              fontWeight: 700,
              color: "#4a4a4a",
            }}
          >
            <span>{clampText(body.footer ?? "ottline.app", 64)}</span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                padding: `${s(12)}px ${s(18)}px`,
                borderRadius: s(8),
                backgroundColor: "#ffffff",
                border: "1px solid #ecebe9",
                color: accent,
              }}
            >
              {body.watermark ?? "ottline.app"}
            </span>
          </div>
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
      `Recap card error: ${error instanceof Error ? error.message : "unknown"}`,
      { status: 500 },
    );
  }
}

async function imageDataUrlForRemoteImage(
  src: string | null | undefined,
): Promise<string | null> {
  if (!src) return null;
  try {
    const resized = tmdbResize(src, "w500") ?? src;
    const res = await fetch(resized);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
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
  const body = (await req.json()) as ShareCardPayload | RecapShareCardPayload;
  if (body.cardType === "recap") {
    return renderRecapShareCard(body);
  }
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
  const localeSegment = pathname.split("/")[1] || "ko";
  const locale = localeSegment === "en" ? "en" : "ko";
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
