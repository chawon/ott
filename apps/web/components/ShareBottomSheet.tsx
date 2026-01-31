"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WatchLog } from "@/lib/types";
import { downloadBlob, fetchShareCardBlob, shareBlob } from "@/lib/share";
import { cn, ratingDisplay, statusLabel } from "@/lib/utils";
import { useRetro } from "@/context/RetroContext";

export default function ShareBottomSheet({
  open,
  log,
  onClose,
}: {
  open: boolean;
  log: WatchLog | null;
  onClose: () => void;
}) {
  const [showRatingLabel, setShowRatingLabel] = useState(true);
  const [showNote, setShowNote] = useState(true);
  const [format, setFormat] = useState<"story" | "feed">("story");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareCardBlob, setShareCardBlob] = useState<Blob | null>(null);
  const { isRetro } = useRetro();
  const previewAspect = format === "feed" ? "aspect-[4/5]" : "aspect-[9/16]";
  const sizeLabel = format === "feed" ? "1080×1350 (Feed)" : "1080×1920 (Story)";

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
    const rating = ratingDisplay(log.rating, log.title?.type);
    const note = log.note ? log.note : null;
    return {
      title: log.title.name,
      titleType: log.title?.type,
      format,
      note: showNote ? note : null,
      statusLabel: statusLabel(log.status, log.title?.type),
      ratingLabel: showRatingLabel && rating ? rating.label : null,
      ratingValue: showRatingLabel && rating ? rating.value : null,
      date: `${year}.${month}.${day}`,
      posterUrl: log.seasonPosterUrl ?? log.title.posterUrl ?? null,
      watermark: isRetro ? "으뜸과 버금" : "On the Timeline",
      theme: (isRetro ? "retro" : "default") as "retro" | "default",
    };
  }, [format, isRetro, log, showNote, showRatingLabel]);

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
    const safeTitle = log.title.name.replace(/[^a-zA-Z0-9가-힣_-]+/g, "_").slice(0, 40);
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
      const text = `내 기록 공유: ${log.title.name}`;
      const shared = await shareBlob(blob, filename, log.title.name, text);
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
          "p-0"
        )}
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-base">공유 카드 만들기</SheetTitle>
          <div className="text-xs text-muted-foreground">저장한 기록을 이미지로 공유해보세요.</div>
        </SheetHeader>

        <div className="grid grid-cols-1 gap-6 px-6 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-muted/60 p-4">
              <div className="mx-auto flex w-full justify-center">
                <div className={cn("relative w-[280px] overflow-hidden rounded-2xl bg-card shadow-sm", previewAspect)}>
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="공유 카드 미리보기"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      미리보기 준비 중...
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
                평점 문구 포함
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showNote}
                  onChange={(e) => setShowNote(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                  disabled={!log?.note}
                />
                한 줄 메모 포함
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>이미지 비율</span>
              <div className="flex items-center rounded-full border border-border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setFormat("story")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    format === "story" ? "bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  스토리 9:16
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("feed")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition",
                    format === "feed" ? "bg-foreground text-background" : "text-muted-foreground"
                  )}
                >
                  피드 4:5
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
              이미지 저장
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={busy || !log || !shareCardBlob}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" />
              {shareCardBlob ? "공유하기" : "준비 중..."}
            </button>
            <div className="text-[11px] text-muted-foreground">
              이미지 크기: {sizeLabel}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
