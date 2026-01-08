"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, MessageSquare, Star, Users, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import TitleSearchBox from "@/components/TitleSearchBox";
import { enqueueCreateLog, findTitleByProvider, upsertLogLocal } from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import { safeUUID, OCCASION_LABELS, PLACE_LABELS, STATUS_LABELS } from "@/lib/utils";
import {
    Occasion,
    Place,
    Status,
    TitleSearchItem,
    WatchLog,
} from "@/lib/types";

const PLACE_OPTIONS: { value: Place; label: string }[] = (Object.keys(PLACE_LABELS) as Place[])
    .map((value) => ({ value, label: PLACE_LABELS[value] }));

const OCCASION_OPTIONS: { value: Occasion; label: string }[] = (Object.keys(OCCASION_LABELS) as Occasion[])
    .map((value) => ({ value, label: OCCASION_LABELS[value] }));

const STATUS_OPTIONS: { value: Status; label: string }[] = (Object.keys(STATUS_LABELS) as Status[])
    .map((value) => ({ value, label: STATUS_LABELS[value] }));

export default function QuickLogCard({
                                         onCreated,
                                     }: {
    onCreated: (log: WatchLog) => void;
}) {
    const [selected, setSelected] = useState<TitleSearchItem | null>(null);
    const [status, setStatus] = useState<Status>("IN_PROGRESS");
    const [rating, setRating] = useState<number | "">("");
    const [note, setNote] = useState("");
    const [ott, setOtt] = useState("");
    const [place, setPlace] = useState<Place>("HOME");
    const [occasion, setOccasion] = useState<Occasion>("ALONE");
    const [useWatchedAt, setUseWatchedAt] = useState(false);
    const [watchedDate, setWatchedDate] = useState("");
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const canSave = useMemo(() => !!selected && !saving, [selected, saving]);

    function toDateInput(d: Date) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function dateToIso(date: string) {
        return new Date(`${date}T00:00:00`).toISOString();
    }

    useEffect(() => {
        if (useWatchedAt && !watchedDate) {
            setWatchedDate(toDateInput(new Date()));
        }
    }, [useWatchedAt, watchedDate]);

    useEffect(() => {
        if (place === "THEATER") {
            setOtt("극장");
            return;
        }
        if (ott === "극장") setOtt("");
    }, [place, ott]);

    async function submit() {
        if (!selected || saving) return;

        setSaving(true);
        try {
            const now = new Date().toISOString();
            const existingTitle = selected.titleId
                ? null
                : await findTitleByProvider(selected.provider, selected.providerId);
            const localTitleId = selected.titleId ?? existingTitle?.id ?? safeUUID();
            const localLogId = safeUUID();

            const pickedWatchedAt = useWatchedAt && watchedDate ? dateToIso(watchedDate) : now;
            const localLog: WatchLog = {
                id: localLogId,
                title: {
                    id: localTitleId,
                    type: selected.type,
                    name: selected.name,
                    year: selected.year ?? undefined,
                    posterUrl: selected.posterUrl ?? undefined,
                    overview: selected.overview ?? undefined,
                    provider: selected.provider,
                    providerId: selected.providerId,
                    updatedAt: now,
                },
                status,
                rating: rating === "" ? null : rating,
                note: note.trim() ? note.trim() : null,
                ott: ott.trim() ? ott.trim() : null,
                spoiler: false,
                watchedAt: pickedWatchedAt,
                createdAt: now,
                place,
                occasion,
                syncStatus: "pending",
                updatedAt: now,
            };

            await upsertLogLocal(localLog);
            await enqueueCreateLog({
                logId: localLogId,
                titleId: localTitleId,
                updatedAt: now,
                log: {
                    id: localLogId,
                    op: "upsert",
                    updatedAt: now,
                    payload: {
                        titleId: localTitleId,
                        status,
                        rating: rating === "" ? null : rating,
                        note: note.trim() ? note.trim() : null,
                        ott: ott.trim() ? ott.trim() : null,
                        spoiler: false,
                        watchedAt: pickedWatchedAt,
                        place,
                        occasion,
                    },
                },
                title: {
                    id: localTitleId,
                    op: "upsert",
                    updatedAt: now,
                    payload: {
                        type: selected.type,
                        name: selected.name,
                        year: selected.year ?? null,
                        genres: null,
                        overview: selected.overview ?? null,
                        posterUrl: selected.posterUrl ?? null,
                        provider: selected.provider,
                        providerId: selected.providerId,
                    },
                },
            });
            onCreated(localLog);
            await syncOutbox();

            setToast("SAVED!");
            window.setTimeout(() => setToast(null), 1800);

            setSelected(null);
            setStatus("IN_PROGRESS");
            setRating("");
            setNote("");
            setOtt("");
            setPlace("HOME");
            setOccasion("ALONE");
            setUseWatchedAt(false);
            setWatchedDate("");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="relative">
            <section className="nes-container !bg-white">
                <div className="absolute -top-4 left-4 bg-white border-2 border-black px-2 text-xs font-bold tracking-widest uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    새로운 기록
                </div>

                <div className="space-y-4">
                    <TitleSearchBox onSelect={(item) => setSelected(item)} />

                    {selected ? (
                        <div className="border-4 border-black bg-[#212529] p-2 text-white">
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-12 shrink-0 border-2 border-white bg-neutral-800">
                                    {selected.posterUrl ? (
                                        <img
                                            src={selected.posterUrl}
                                            alt={selected.name}
                                            className="h-full w-full object-cover pixelated"
                                            style={{ imageRendering: "pixelated" }}
                                            loading="lazy"
                                        />
                                    ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-bold text-yellow-400">
                                        {selected.name}
                                    </div>
                                    <div className="mt-1 text-xs text-neutral-400">
                                        {selected.type === "movie" ? "영화" : "시리즈"}
                                        {selected.year ? ` · ${selected.year}` : ""}
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelected(null)}
                                    className="h-8 w-8 flex items-center justify-center bg-red-600 text-white border-2 border-white hover:bg-red-700"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase">상태</label>
                            <div className="relative">
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as Status)}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                >
                                    {STATUS_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase flex items-center gap-1"><Star className="h-3 w-3" /> 평점</label>
                            <select
                                value={rating === "" ? "" : String(rating)}
                                onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full bg-white px-3 py-2 text-sm font-bold"
                            >
                                <option value="">선택 안함</option>
                                <option value="5">★★★★★ 최고!</option>
                                <option value="3">★★★ 그럭저럭</option>
                                <option value="1">★ 별로...</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase flex items-center gap-1"><MapPin className="h-3 w-3" /> 장소</label>
                            <select
                                value={place}
                                onChange={(e) => setPlace(e.target.value as Place)}
                                className="w-full bg-white px-3 py-2 text-sm font-bold"
                            >
                                {PLACE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase flex items-center gap-1"><Users className="h-3 w-3" /> 누구와</label>
                            <select
                                value={occasion}
                                onChange={(e) => setOccasion(e.target.value as Occasion)}
                                className="w-full bg-white px-3 py-2 text-sm font-bold"
                            >
                                {OCCASION_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                            <label className="text-xs font-bold uppercase">플랫폼 (OTT)</label>
                            <input
                                value={ott}
                                onChange={(e) => setOtt(e.target.value)}
                                className="w-full bg-white px-3 py-2 text-sm font-bold placeholder:text-neutral-400"
                                placeholder="넷플릭스, 디즈니+, 극장 등..."
                            />
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                            <button
                                type="button"
                                onClick={() => setUseWatchedAt(!useWatchedAt)}
                                className={cn(
                                    "flex items-center gap-2 text-xs font-bold uppercase",
                                    useWatchedAt ? "text-blue-600" : "text-neutral-500 hover:text-black"
                                )}
                            >
                                <Calendar className="h-3.5 w-3.5" />
                                {useWatchedAt ? "날짜 직접 입력" : "오늘 보셨나요?"}
                            </button>
                            {useWatchedAt && (
                                <input
                                    type="date"
                                    value={watchedDate}
                                    onChange={(e) => setWatchedDate(e.target.value)}
                                    className="w-full bg-white px-3 py-2 text-sm font-bold"
                                />
                            )}
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                            <label className="text-xs font-bold uppercase flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 메모</label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full min-h-[80px] bg-white px-3 py-2 text-sm font-bold placeholder:text-neutral-400 resize-none"
                                placeholder="짧은 감상을 남겨보세요..."
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        disabled={!canSave}
                        onClick={submit}
                        className={cn(
                            "nes-btn is-primary w-full py-3 text-sm",
                            !canSave && "opacity-50 cursor-not-allowed bg-neutral-300 border-neutral-500 text-neutral-500"
                        )}
                    >
                        {saving ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                저장 중...
                            </span>
                        ) : (
                            "기록 저장하기"
                        )}
                    </button>
                </div>
            </section>

            {toast ? (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
                    <div className="border-4 border-black bg-[#f7d51d] px-4 py-2 text-sm font-bold text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        {toast}
                    </div>
                </div>
            ) : null}
        </div>
    );
}