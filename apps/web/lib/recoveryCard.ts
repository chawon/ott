export type PairingRecoveryCardCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  codeLabel: string;
  instructionTitle: string;
  instructionBody: string;
  warningTitle: string;
  warningBody: string;
  footer: string;
};

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1440;

function roundedRect(
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

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
  lineWidth = 2,
) {
  roundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth || !line) {
      line = testLine;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);

  for (const [index, currentLine] of lines.entries()) {
    ctx.fillText(currentLine, x, y + index * lineHeight);
  }

  return y + lines.length * lineHeight;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  code: string,
  copy: PairingRecoveryCardCopy,
) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "#dbeafe";
  ctx.fillRect(0, 0, CARD_WIDTH, 18);
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(0, CARD_HEIGHT - 18, CARD_WIDTH, 18);

  ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 24;
  fillRoundedRect(ctx, 70, 70, 940, 1300, 44, "#ffffff");
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  fillRoundedRect(ctx, 130, 130, 228, 58, 29, "#eff6ff");
  ctx.fillStyle = "#1d4ed8";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(copy.eyebrow, 244, 160);

  ctx.fillStyle = "#111827";
  ctx.font = "800 70px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(copy.title, 130, 285);

  ctx.fillStyle = "#475569";
  ctx.font = "400 32px Arial, sans-serif";
  drawWrappedText(ctx, copy.subtitle, 130, 345, 820, 44);

  fillRoundedRect(ctx, 130, 455, 820, 250, 36, "#111827");
  ctx.fillStyle = "#93c5fd";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(copy.codeLabel, 540, 525);

  ctx.fillStyle = "#ffffff";
  ctx.font =
    "800 104px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.fillText(code, 540, 625);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText("ottline.app", 540, 672);

  ctx.textAlign = "left";
  ctx.fillStyle = "#111827";
  ctx.font = "800 38px Arial, sans-serif";
  ctx.fillText(copy.instructionTitle, 130, 805);

  ctx.fillStyle = "#475569";
  ctx.font = "400 30px Arial, sans-serif";
  drawWrappedText(ctx, copy.instructionBody, 130, 865, 820, 42);

  fillRoundedRect(ctx, 130, 1010, 820, 210, 30, "#fff7ed");
  strokeRoundedRect(ctx, 130, 1010, 820, 210, 30, "#fed7aa", 3);
  ctx.fillStyle = "#9a3412";
  ctx.font = "800 32px Arial, sans-serif";
  ctx.fillText(copy.warningTitle, 175, 1080);

  ctx.fillStyle = "#7c2d12";
  ctx.font = "400 27px Arial, sans-serif";
  drawWrappedText(ctx, copy.warningBody, 175, 1135, 730, 38);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(130, 1280);
  ctx.lineTo(950, 1280);
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.font = "400 24px Arial, sans-serif";
  drawWrappedText(ctx, copy.footer, 130, 1332, 820, 34);
}

export async function createPairingRecoveryCardBlob(
  pairingCode: string,
  copy: PairingRecoveryCardCopy,
) {
  if (typeof document === "undefined") {
    throw new Error("Recovery card rendering requires a browser");
  }

  const code = pairingCode.trim().toUpperCase();
  if (!code) throw new Error("Pairing code is required");

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  drawCard(ctx, code, copy);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create recovery card"));
      }
    }, "image/png");
  });
}
