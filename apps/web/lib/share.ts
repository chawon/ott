export type ShareCardPayload = {
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

export async function fetchShareCardBlob(payload: ShareCardPayload) {
  const res = await fetch("/og/share-card", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to render share card");
  return res.blob();
}

export async function downloadBlob(blob: Blob, filename: string) {
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
  url?: string
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
      return false;
    }
  }

  return false;
}
