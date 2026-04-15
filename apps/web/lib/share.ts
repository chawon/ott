import {
  isAppsInTossEnvironment,
  saveBlobInAppsInToss,
  shareTextInAppsInToss,
} from "@/lib/appsInToss";
import { renderShareCardBlobLocally } from "@/lib/shareCardCanvas";
import { buildAppUrl, getCurrentLocale } from "@/lib/url";

export type ShareCardPayload = {
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

export async function fetchShareCardBlob(payload: ShareCardPayload) {
  if (isAppsInTossEnvironment()) {
    return renderShareCardBlobLocally(payload);
  }

  const locale = getCurrentLocale();
  try {
    const res = await fetch(buildAppUrl(`/${locale}/og/share-card`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to render share card");
    return res.blob();
  } catch {
    return renderShareCardBlobLocally(payload);
  }
}

export async function downloadBlob(blob: Blob, filename: string) {
  try {
    const savedInAppsInToss = await saveBlobInAppsInToss(blob, filename);
    if (savedInAppsInToss) return;
  } catch {
    // Fall through to browser download when the native bridge is unavailable.
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function shareBlob(
  blob: Blob,
  filename: string,
  title: string,
  text?: string,
  url?: string,
) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShare && typeof navigator.share === "function") {
    try {
      await navigator.share({ files: [file], title, text, url });
      return true;
    } catch {
      // Fall through to other share mechanisms.
    }
  }

  if (text) {
    try {
      const sharedInAppsInToss = await shareTextInAppsInToss(text);
      if (sharedInAppsInToss) return true;
    } catch {
      // Keep fallback behavior for environments without native share support.
    }
  }

  return false;
}
