"use client";

import { useEffect, useMemo, useState } from "react";
import TitleSearchBox from "@/components/TitleSearchBox";
import { enqueueCreateLog, findTitleByProvider, upsertLogLocal } from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import { safeUUID } from "@/lib/utils";
import { OCCASION_LABELS, PLACE_LABELS, STATUS_LABELS } from "@/lib/utils";
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
    }, [place]);

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

            setToast("Saved ✓");
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
        <>
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">

                <TitleSearchBox onSelect={(item) => setSelected(item)} />

                {selected ? (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-14 w-10 overflow-hidden rounded-md bg-neutral-100">
                                {selected.posterUrl ? (
                                    <img
                                        src={selected.posterUrl}
                                        alt={selected.name}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                ) : null}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-neutral-900">
                                    {selected.name}
                                </div>
                                <div className="mt-0.5 text-xs text-neutral-500">
                                    {selected.type === "movie" ? "Movie" : "Series"}
                                    {selected.year ? ` · ${selected.year}` : ""}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                        <div className="text-xs text-neutral-600">Status</div>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as Status)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-1">
                        <div className="text-xs text-neutral-600">Rating</div>
                        <select
                            value={rating === "" ? "" : String(rating)}
                            onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">선택 안함</option>
                            <option value="5">😍 나에게 최고</option>
                            <option value="3">🙂 그럭저럭</option>
                            <option value="1">😕 나는 실망</option>
                        </select>
                    </label>

                    <label className="space-y-1">
                        <div className="text-xs text-neutral-600">Place</div>
                        <select
                            value={place}
                            onChange={(e) => setPlace(e.target.value as Place)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                        >
                            {PLACE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-1">
                        <div className="text-xs text-neutral-600">Occasion</div>
                        <select
                            value={occasion}
                            onChange={(e) => setOccasion(e.target.value as Occasion)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                        >
                            {OCCASION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-1 md:col-span-2">
                        <div className="text-xs text-neutral-600">OTT</div>
                        <input
                            value={ott}
                            onChange={(e) => setOtt(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                            placeholder="Netflix, Disney+, YouTube…"
                        />
                    </label>

                    <div className="md:col-span-2 space-y-2">
                        <label className="flex items-center gap-2 text-xs text-neutral-600">
                            <input
                                type="checkbox"
                                checked={useWatchedAt}
                                onChange={(e) => setUseWatchedAt(e.target.checked)}
                            />
                            날짜 변경
                        </label>
                        {useWatchedAt ? (
                            <input
                                type="date"
                                value={watchedDate}
                                onChange={(e) => setWatchedDate(e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                            />
                        ) : null}
                    </div>

                    <label className="space-y-1 md:col-span-2">
                        <div className="text-xs text-neutral-600">Note</div>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                            placeholder="한 줄 메모"
                            rows={3}
                        />
                    </label>
                </div>

                <button
                    type="button"
                    disabled={!canSave}
                    onClick={submit}
                    className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                    {saving ? "Saving…" : "기록 저장"}
                </button>
            </section>

            {toast ? (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
                    {toast}
                </div>
            ) : null}
        </>
    );
}
