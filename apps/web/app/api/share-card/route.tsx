import { ImageResponse } from "next/og";
import fs from "node:fs/promises";

export const runtime = "nodejs";

type ShareCardPayload = {
  title: string;
  note?: string | null;
  statusLabel: string;
  ratingLabel?: string | null;
  ratingValue?: number | null;
  date: string;
  posterUrl?: string | null;
  watermark: string;
  theme: "default" | "retro";
};

function clampText(text: string, maxLen: number) {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function normalizeNote(text: string) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.slice(0, 2).join("\n");
}

function formatTitleForCard(title: string) {
  const idx = title.indexOf(":");
  if (idx === -1) return title;
  const before = title.slice(0, idx + 1);
  const after = title.slice(idx + 1).trim();
  return `${before}\n${after}`;
}

export async function POST(req: Request) {
  try {
    const fontRegularPath = "/usr/share/fonts/truetype/nanum/NanumSquareR.ttf";
    const fontBoldPath = "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf";
    const fonts: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }> = [];

    try {
      const data = await fs.readFile(fontRegularPath);
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      fonts.push({ name: "NanumSquare", data: buffer, weight: 400, style: "normal" });
    } catch {}

    try {
      const data = await fs.readFile(fontBoldPath);
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      fonts.push({ name: "NanumSquare", data: buffer, weight: 700, style: "normal" });
    } catch {}

    const body = (await req.json()) as ShareCardPayload;
    const title = clampText(body.title ?? "", 60);
    const formattedTitle = formatTitleForCard(title);
    const note = body.note ? clampText(normalizeNote(body.note), 80) : null;
    let posterUrl = body.posterUrl ?? null;
    const watermark = body.watermark ?? "On the Timeline";
    const isRetro = body.theme === "retro";

    if (posterUrl) {
      try {
        const res = await fetch(posterUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const contentType = res.headers.get("content-type") || "image/jpeg";
          posterUrl = `data:${contentType};base64,${base64}`;
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
            backgroundColor: isRetro ? "#f8f2e9" : "#0b0c10",
            color: isRetro ? "#111827" : "#ffffff",
            fontFamily: "NanumSquare, sans-serif",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "70%",
              display: "flex",
              position: "relative",
              backgroundColor: isRetro ? "#f8f2e9" : "#111827",
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
                  objectPosition: "center 12%",
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
                  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.55) 100%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "18%",
                display: "flex",
                background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)",
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
              padding: "64px 88px 72px",
              backgroundColor: isRetro ? "#fff6dd" : "#0b1224",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 84,
                  fontWeight: isRetro ? 700 : 700,
                  lineHeight: 1.05,
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
                    fontSize: 38,
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
                  gap: 12,
                  flexWrap: "wrap",
                  fontSize: 28,
                  fontWeight: isRetro ? 700 : 600,
                  color: isRetro ? "#374151" : "#cbd5f5",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 999,
                    backgroundColor: isRetro ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.08)",
                    height: 48,
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
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 999,
                      backgroundColor: isRetro ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.08)",
                      height: 48,
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
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 999,
                    backgroundColor: isRetro ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.08)",
                    height: 48,
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
              bottom: 64,
              left: 88,
              display: "flex",
              fontSize: 26,
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
        width: 1080,
        height: 1920,
        fonts,
      }
    );
  } catch (error) {
    return new Response(`Share card error: ${error instanceof Error ? error.message : "unknown"}`, {
      status: 500,
    });
  }
}
