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
  theme: "default";
};

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
  if (dashIndex !== -1) {
    cutIndex = cutIndex === -1 ? dashIndex : Math.min(cutIndex, dashIndex);
  }
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

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let truncated = false;

  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const char of Array.from(paragraph)) {
      const candidate = current + char;
      if (
        current.length === 0 ||
        ctx.measureText(candidate).width <= maxWidth
      ) {
        current = candidate;
        continue;
      }

      lines.push(current);
      current = char;

      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }

    if (truncated) break;
    if (current) {
      lines.push(current);
    }
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
  }

  if (lines.length === 0) return lines;

  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }

  if (truncated) {
    let last = lines[maxLines - 1] ?? "";
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }

  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + lineHeight * index);
  });
}

function rgbToCss(r: number, g: number, b: number) {
  return `rgb(${r}, ${g}, ${b})`;
}

function darkenColor(rgb: [number, number, number], factor: number) {
  return rgbToCss(
    Math.floor(rgb[0] * factor),
    Math.floor(rgb[1] * factor),
    Math.floor(rgb[2] * factor),
  );
}

function getAverageColor(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
): [number, number, number] | null {
  try {
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = 12;
    sampleCanvas.height = 12;
    const sampleCtx = sampleCanvas.getContext("2d");
    if (!sampleCtx) return null;
    sampleCtx.drawImage(image, 0, 0, 12, 12);
    const data = sampleCtx.getImageData(0, 0, 12, 12).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
    if (count === 0) return null;
    return [
      Math.round(r / count),
      Math.round(g / count),
      Math.round(b / count),
    ];
  } catch {
    return null;
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to render share card blob"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  isBook: boolean,
) {
  const targetHeight = Math.round(height * 0.7);
  const scale = Math.max(width / image.width, targetHeight / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const dx = (width - drawWidth) / 2;
  const dy = isBook ? 0 : (targetHeight - drawHeight) * 0.12;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  options?: { fillStyle?: string; textColor?: string },
) {
  const horizontalPadding = 22;
  const height = 48;
  const width = Math.ceil(ctx.measureText(label).width) + horizontalPadding * 2;
  drawRoundedRect(
    ctx,
    x,
    y,
    width,
    height,
    999,
    options?.fillStyle ?? "rgba(255,255,255,0.12)",
  );
  ctx.save();
  ctx.fillStyle = options?.textColor ?? "#cbd5f5";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + horizontalPadding, y + height / 2);
  ctx.restore();
  return width;
}

export async function renderShareCardBlobLocally(payload: ShareCardPayload) {
  if (typeof document === "undefined") {
    throw new Error("Canvas rendering is unavailable");
  }

  const format = payload.format ?? "story";
  const isFeed = format === "feed";
  const width = 1080;
  const height = isFeed ? 1350 : 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context is unavailable");
  }

  const rawTitle = payload.title ?? "";
  const isBook = payload.titleType === "book";
  const cleanedTitle = isBook ? stripBookSubtitle(rawTitle) : rawTitle;
  const title = clampText(cleanedTitle, 60);
  const formattedTitle = formatTitleForCard(title);
  const note = payload.note
    ? clampText(normalizeNote(payload.note, isBook ? 3 : 2), isBook ? 120 : 80)
    : null;

  let backgroundColor = "#0b0c10";
  let contentBgColor = "#0b1224";

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  let posterImage: HTMLImageElement | null = null;
  const posterUrl = tmdbResize(payload.posterUrl, "w780") ?? payload.posterUrl;
  if (posterUrl) {
    try {
      posterImage = await loadImage(posterUrl);
      const averageColor = getAverageColor(ctx, posterImage);
      if (averageColor) {
        backgroundColor = darkenColor(averageColor, 0.2);
        contentBgColor = darkenColor(averageColor, 0.25);
      }
    } catch {
      posterImage = null;
    }
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (posterImage) {
    drawCoverImage(ctx, posterImage, width, height, isBook);
  }

  const topHeight = Math.round(height * 0.7);
  const gradient = ctx.createLinearGradient(0, topHeight * 0.64, 0, topHeight);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, contentBgColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, topHeight);

  ctx.fillStyle = contentBgColor;
  ctx.fillRect(0, topHeight, width, height - topHeight);

  const scale = isFeed ? 0.8 : 1;
  const s = (value: number) => Math.round(value * scale);
  const paddingX = s(88);
  const contentY = topHeight + s(64);
  const contentWidth = width - paddingX * 2;

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.font = `${isBook ? s(64) : s(84)}px sans-serif`;
  const titleLines = wrapText(ctx, formattedTitle, contentWidth, isBook ? 3 : 2);
  const titleLineHeight = Math.round((isBook ? s(64) : s(84)) * (isBook ? 1.12 : 1.05));
  drawTextLines(ctx, titleLines, paddingX, contentY, titleLineHeight);

  let cursorY = contentY + titleLines.length * titleLineHeight + s(20);

  if (note) {
    ctx.fillStyle = "#dbe4ff";
    ctx.font = `${isBook ? s(40) : s(38)}px sans-serif`;
    const noteLines = wrapText(ctx, `“${note}”`, contentWidth, isBook ? 3 : 2);
    const noteLineHeight = Math.round((isBook ? s(40) : s(38)) * 1.3);
    drawTextLines(ctx, noteLines, paddingX, cursorY, noteLineHeight);
    cursorY += noteLines.length * noteLineHeight + s(28);
  }

  ctx.font = `${s(isBook ? 26 : 28)}px sans-serif`;
  let chipX = paddingX;
  const chipY = cursorY;
  const gap = s(12);
  chipX += drawPill(ctx, payload.statusLabel, chipX, chipY);
  chipX += gap;

  if (payload.ratingLabel) {
    const ratingText =
      typeof payload.ratingValue === "number"
        ? `${payload.ratingLabel} ${payload.ratingValue.toFixed(1)}`
        : payload.ratingLabel;
    chipX += drawPill(ctx, ratingText, chipX, chipY);
    chipX += gap;
  }

  drawPill(ctx, payload.date, chipX, chipY);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `${s(26)}px sans-serif`;
  ctx.fillText(payload.watermark ?? "ottline.app", paddingX, height - s(96));

  return canvasToBlob(canvas);
}
