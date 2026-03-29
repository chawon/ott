"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WatchLog } from "@/lib/types";
import { downloadBlob, fetchShareCardBlob, shareBlob } from "@/lib/share";
import { cn, ratingDisplay, statusLabel } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

export default function ShareBottomSheet({
  open,
  log,
  onClose,
}: {
  open: boolean;
  log: WatchLog | null;
  onClose: () => void;
}) {
  const tShare = useTranslations("ShareBottomSheet");
  const tStatus = useTranslations("Status");
  const tQuick = useTranslations("QuickLogCard");
  const [showRatingLabel, setShowRatingLabel] = useState(true);
  const [showNote, setShowNote] = useState(true);
  const [format, setFormat] = useState<"story" | "feed">("story");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareCardBlob, setShareCardBlob] = useState<Blob | null>(null);
  const previewAspect = format === "feed" ? "aspect-[4/5]" : "aspect-[9/16]";
  const sizeLabel =
    format === "feed" ? "1080×1350 (Feed)" : "1080×1920 (Story)";

  useEffect(() => {
    if (!log) return;
    setShowRatingLabel(true);
    setShowNote(Boolean(log.note));
  }, [log]);

  const payload = useMemo(() => {
    if (!log) return null;
    const date = new Date(log.watchedAt || log.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const rating = ratingDisplay(log.rating, log.title?.type, tQuick);
    const note = log.note ? log.note : null;
    return {
      title: log.title.name,
      titleType: log.title?.type,
      format,
      note: showNote ? note : null,
      statusLabel: statusLabel(log.status, log.title?.type, tStatus),
      ratingLabel: showRatingLabel && rating ? rating.label : null,
      ratingValue: showRatingLabel && rating ? rating.value : null,
      date: `${year}.${month}.${day}`,
      posterUrl: log.seasonPosterUrl ?? log.title.posterUrl ?? null,
      watermark: "ottline.app",
      theme: "default" as const,
    };
  }, [format, log, showNote, showRatingLabel, tStatus, tQuick]);

  useEffect(() => {
    let active = true;
    async function buildPreview() {
      if (!open || !payload) return;
      try {
        const blob = await fetchShareCardBlob(payload);
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setShareCardBlob(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        // ignore preview failures
      }
    }
    buildPreview();
    return () => {
      active = false;
      setShareCardBlob(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open, payload]);

  function filenameFor(log: WatchLog) {
    const safeTitle = log.title.name
      .replace(/[^a-zA-Z0-9가-힣_-]+/g, "_")
      .slice(0, 40);
    const suffix = format === "feed" ? "feed" : "story";
    return `ott-${safeTitle || "share"}-${suffix}.png`;
  }

  async function buildBlob() {
    if (shareCardBlob) return shareCardBlob;
    if (!payload) throw new Error("No share card payload");
    const blob = await fetchShareCardBlob(payload);
    setShareCardBlob(blob);
    return blob;
  }

  async function handleDownload() {
    if (!log) return;
    try {
      setBusy(true);
      const blob = await buildBlob();
      await downloadBlob(blob, filenameFor(log));
      await trackEvent("share_action", {
        action: "download",
        format,
        titleType: log.title?.type ?? null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (!log) return;
    try {
      setBusy(true);
      const blob = await buildBlob();
      const filename = filenameFor(log);
      const text = tShare("shareText", { title: log.title.name });
      const shared = await shareBlob(blob, filename, log.title.name, text);
      await trackEvent("share_action", {
        action: shared ? "share" : "fallback_download",
        format,
        titleType: log.title?.type ?? null,
      });
      if (!shared) {
        await downloadBlob(blob, filename);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card text-card-foreground",
          "p-0",
        )}
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-base">{tShare("title")}</SheetTitle>
          <div className="text-xs text-muted-foreground">
            {tShare("description")}
          </div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-6 px-6 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-muted/60 p-4">
              <div className="mx-auto flex w-full justify-center">
                <div
                  className={cn(
                    "relative w-[280px] overflow-hidden rounded-2xl bg-card shadow-sm",
                    previewAspect,
                  )}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={tShare("previewAlt")}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      {tShare("previewLoading")}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showRatingLabel}
                  onChange={(e) => setShowRatingLabel(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {tShare("toggleRating")}
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showNote}
                  onChange={(e) => setShowNote(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                  disabled={!log?.note}
                />
                {tShare("toggleNote")}
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{tShare("ratioLabel")}</span>
              <div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setFormat("story")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    format === "story"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground",
                  )}
                >
                  {tShare("ratioStory")}
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("feed")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    format === "feed"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground",
                  )}
                >
                  {tShare("ratioFeed")}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy || !log}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {tShare("downloadAction")}
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={busy || !log || !shareCardBlob}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              {shareCardBlob ? tShare("shareAction") : tShare("preparing")}
            </button>
            <div className="text-[11px] text-muted-foreground">
              {tShare("sizeLabel", { size: sizeLabel })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
