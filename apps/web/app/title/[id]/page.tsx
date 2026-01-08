"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import CommentsPanel from "@/components/CommentsPanel";
import {
    getTitleLocal,
    getUserId,
    listHistoryLocal,
    listLogsByTitleLocal,
    upsertHistoryLocal,
    upsertLogsLocal,
    upsertTitleLocal,
    updateLogLocal,
    updatePendingCreatePayload,
    enqueueUpdateLog,
} from "@/lib/localStore";
import { syncOutbox } from "@/lib/sync";
import {
    Occasion,
    Place,
    Status,
    Title,
    WatchLog,
    WatchLogHistory,
} from "@/lib/types";
import { formatNoteInline, OCCASION_LABELS, PLACE_LABELS, STATUS_LABELS, ratingDisplay, safeUUID } from "@/lib/utils";

const PLACE_OPTIONS: { value: Place; label: string }[] = (Object.keys(PLACE_LABELS) as Place[])
    .map((value) => ({ value, label: PLACE_LABELS[value] }));
const OCCASION_OPTIONS: { value: Occasion; label: string }[] = (Object.keys(OCCASION_LABELS) as Occasion[])
    .map((value) => ({ value, label: OCCASION_LABELS[value] }));
const STATUS_OPTIONS: { value: Status; label: string }[] = (Object.keys(STATUS_LABELS) as Status[])
    .map((value) => ({ value, label: STATUS_LABELS[value] }));

function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDateInput(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function dateToIso(date: string) {
    return new Date(`${date}T00:00:00`).toISOString();
}

function chip(label: string, tone: "place" | "occasion") {
    const toneClass = tone === "place"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
    return (
        <span className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>
            {label}
        </span>
    );
}

function renderBody(text: string) {
    const parts = text.split(/(@\{[^}]+\})/g);
    return parts.map((p, idx) => {
        if (p.startsWith("@{") && p.endsWith("}")) {
            const name = p.slice(2, -1);
            return (
                <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
                    @{name}
                </span>
            );
        }
        if (p.startsWith("@")) {
            return (
                <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
                    {p}
                </span>
            );
        }
        return <span key={idx}>{p}</span>;
    });
}

export default function TitlePage() {
    const params = useParams<{ id: string }>();
    const rawId = params?.id;
    const titleId = Array.isArray(rawId) ? rawId[0] : rawId;

    const [title, setTitle] = useState<Title | null>(null);
    const [log, setLog] = useState<WatchLog | null>(null);
    const [history, setHistory] = useState<WatchLogHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [status, setStatus] = useState<Status>("IN_PROGRESS");
    const [rating, setRating] = useState<number | "">("");
    const [ott, setOtt] = useState("");
    const [note, setNote] = useState("");
    const [place, setPlace] = useState<Place>("HOME");
    const [occasion, setOccasion] = useState<Occasion>("ALONE");
    const [useWatchedAt, setUseWatchedAt] = useState(false);
    const [watchedDate, setWatchedDate] = useState("");
    const [userId, setUserId] = useState<string | null>(null);

    async function reloadAll() {
        if (!titleId) return;
        setLoading(true);
        setErr(null);

        let hadLocal = false;
        try {
            const localApplied = await loadLocalOnly();
            if (localApplied) hadLocal = true;

            const t = await api<Title>(`/titles/${titleId}`);
            const logs = await api<WatchLog[]>(`/logs?titleId=${encodeURIComponent(titleId)}&limit=1`);
            const current = logs[0] ?? null;

            setTitle(t);
            setLog(current);
            await upsertTitleLocal(t);
            await upsertLogsLocal(logs);

            if (current) {
                setStatus(current.status);
                setRating(typeof current.rating === "number" ? current.rating : "");
                setOtt(current.ott ?? "");
                setNote(current.note ?? "");
                setPlace((current.place ?? "HOME") as Place);
                setOccasion((current.occasion ?? "ALONE") as Occasion);
                setWatchedDate(toDateInput(new Date(current.watchedAt ?? current.createdAt)));

                const h = await api<WatchLogHistory[]>(`/logs/${current.id}/history?limit=50`);
                setHistory(h);
                await upsertHistoryLocal(h);
            } else {
                setHistory([]);
            }
        } catch (e: any) {
            if (!hadLocal) {
                setErr(e?.message ?? "Failed to load");
            }
        } finally {
            setLoading(false);
        }
    }

    async function loadLocalOnly() {
        if (!titleId) return false;
        let applied = false;
        const localTitle = await getTitleLocal(titleId);
        const localLogs = await listLogsByTitleLocal(titleId, 1);
        const localCurrent = localLogs[0] ?? null;

        if (localTitle) {
            applied = true;
            setTitle(localTitle);
        }
            if (localCurrent) {
                applied = true;
                setLog(localCurrent);
                setStatus(localCurrent.status);
                setRating(typeof localCurrent.rating === "number" ? localCurrent.rating : "");
                setOtt(localCurrent.ott ?? "");
                setNote(localCurrent.note ?? "");
                setPlace((localCurrent.place ?? "HOME") as Place);
                setOccasion((localCurrent.occasion ?? "ALONE") as Occasion);
                setWatchedDate(toDateInput(new Date(localCurrent.watchedAt ?? localCurrent.createdAt)));

                const localHistory = await listHistoryLocal(localCurrent.id, 50);
                if (localHistory.length > 0) setHistory(localHistory);
            }
        return applied;
    }

    useEffect(() => {
        reloadAll();
    }, [titleId]);

    useEffect(() => {
        if (place === "THEATER") {
            setOtt("극장");
            return;
        }
        if (ott === "극장") setOtt("");
    }, [place]);

    useEffect(() => {
        if (useWatchedAt && !watchedDate) {
            setWatchedDate(toDateInput(new Date()));
        }
    }, [useWatchedAt, watchedDate]);

    useEffect(() => {
        setUserId(getUserId());
    }, []);

    useEffect(() => {
        function handleSync() {
            loadLocalOnly();
        }
        window.addEventListener("sync:updated", handleSync);
        return () => window.removeEventListener("sync:updated", handleSync);
    }, [titleId]);

    const isDirty = useMemo(() => {
        if (!log) return false;
        const baselineRating = typeof log.rating === "number" ? log.rating : null;
        const baselineOtt = log.ott ?? "";
        const baselineNote = log.note ?? "";
        const baselinePlace = (log.place ?? "HOME") as Place;
        const baselineOccasion = (log.occasion ?? "ALONE") as Occasion;
        const baselineWatchedDate = toDateInput(new Date(log.watchedAt ?? log.createdAt));
        return (
            status !== log.status ||
            (rating === "" ? null : rating) !== baselineRating ||
            ott.trim() !== baselineOtt ||
            note.trim() !== baselineNote ||
            place !== baselinePlace ||
            occasion !== baselineOccasion ||
            (useWatchedAt && watchedDate && watchedDate !== baselineWatchedDate)
        );
    }, [log, status, rating, ott, note, place, occasion, useWatchedAt, watchedDate]);

    const canUpdate = useMemo(() => !!log && !saving && isDirty, [log, saving, isDirty]);

    async function updateLog() {
        if (!log || saving) return;
        setSaving(true);
        try {
            if (!isDirty) return;
            const now = new Date().toISOString();
            const pickedWatchedAt = useWatchedAt && watchedDate ? dateToIso(watchedDate) : null;
            const payload = {
                id: log.id,
                op: "upsert",
                updatedAt: now,
                payload: {
                    status,
                    rating: rating === "" ? null : rating,
                    ott: ott.trim() ? ott.trim() : null,
                    note: note.trim() ? note.trim() : null,
                    place,
                    occasion,
                    watchedAt: pickedWatchedAt,
                },
            };

            const updatedLocal: WatchLog = {
                ...log,
                status,
                rating: rating === "" ? null : rating,
                ott: ott.trim() ? ott.trim() : null,
                note: note.trim() ? note.trim() : null,
                place,
                occasion,
                syncStatus: "pending",
                updatedAt: now,
                watchedAt: pickedWatchedAt ?? log.watchedAt,
            };

            setLog(updatedLocal);
            await updateLogLocal(log.id, updatedLocal);
            const historyEntry: WatchLogHistory = {
                id: safeUUID(),
                logId: log.id,
                recordedAt: now,
                status,
                rating: rating === "" ? null : rating,
                note: note.trim() ? note.trim() : null,
                spoiler: false,
                ott: ott.trim() ? ott.trim() : null,
                watchedAt: pickedWatchedAt ?? log.watchedAt,
                place,
                occasion,
            };
            setHistory((prev) => [historyEntry, ...prev]);
            await upsertHistoryLocal([historyEntry]);

            const mergedIntoCreate = await updatePendingCreatePayload(log.id, payload);
            if (!mergedIntoCreate) {
                await enqueueUpdateLog(log.id, payload);
            }
            await syncOutbox();
        } finally {
            setSaving(false);
        }
    }

    if (!titleId) {
        return (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-base font-semibold">Invalid route</div>
            </div>
        );
    }

    if (loading && !title) {
        return (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-sm text-neutral-600">Loading…</div>
            </div>
        );
    }

    if (err) {
        return (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-base font-semibold">Error</div>
                <div className="mt-2 text-sm text-neutral-700">{err}</div>
            </div>
        );
    }

    if (!title) {
        return (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="text-base font-semibold">Not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="h-28 w-20 overflow-hidden rounded-xl bg-neutral-100 sm:h-36 sm:w-24">
                        {title.posterUrl ? (
                            <img
                                src={title.posterUrl}
                                alt={title.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-xl font-semibold">{title.name}</div>
                        <div className="mt-1 text-sm text-neutral-600">
                            {title.type === "movie" ? "Movie" : "Series"}
                            {title.year ? ` · ${title.year}` : ""}
                        </div>
                        {title.genres && title.genres.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {title.genres.map((g) => (
                                    <span
                                        key={g}
                                        className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700"
                                    >
                                        {g}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {title.directors && title.directors.length > 0 ? (
                            <div className="mt-3 text-xs text-neutral-600">
                                감독 · {title.directors.join(", ")}
                            </div>
                        ) : null}
                        {title.cast && title.cast.length > 0 ? (
                            <div className="mt-1 text-xs text-neutral-600">
                                주연 · {title.cast.join(", ")}
                            </div>
                        ) : null}
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
                    <div>
                        <div className="text-base font-semibold">나의 기록</div>
                        <div className="text-sm text-neutral-600">
                            {log ? "내용을 추가하면 히스토리가 자동으로 쌓여" : "아직 이 작품에 대한 기록이 없어. 홈에서 먼저 저장해줘."}
                        </div>
                    </div>

                    {log ? (
                        <>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="space-y-1">
                                    <div className="text-xs text-neutral-600">Status</div>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as Status)}
                                        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s.value} value={s.value}>{s.label}</option>
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
                                        {PLACE_OPTIONS.map((p) => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
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
                                    />
                                </label>

                                <div className="space-y-2 md:col-span-2">
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
                                        rows={3}
                                    />
                                </label>
                            </div>

                            <button
                                type="button"
                                disabled={!canUpdate}
                                onClick={updateLog}
                                className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                            >
                                {saving ? "Updating…" : "Update"}
                            </button>
                        </>
                    ) : null}
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-3">
                    <div>
                        <div className="text-base font-semibold">히스토리</div>
                        <div className="text-sm text-neutral-600">업데이트 할 때마다 스냅샷이 쌓여</div>
                    </div>

                    {!log ? (
                        <div className="text-sm text-neutral-600">아직 히스토리가 없어요.</div>
                    ) : history.length === 0 ? (
                        <div className="text-sm text-neutral-600">아직 히스토리가 없어요.</div>
                    ) : (
                        <div className="space-y-2">
                            {history.map((h) => (
                                <div key={h.id} className="rounded-xl border border-neutral-200 p-4">
                                    <div className="text-sm font-semibold text-neutral-900">
                                        {fmt(h.recordedAt)} · {STATUS_LABELS[h.status]}
                                        {ratingDisplay(h.rating) ? ` · ${ratingDisplay(h.rating)?.emoji} ${ratingDisplay(h.rating)?.label}` : ""}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                        {h.place ? chip(PLACE_LABELS[h.place], "place") : null}
                                        {h.occasion ? chip(OCCASION_LABELS[h.occasion], "occasion") : null}
                                        {h.ott ? (
                                            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-neutral-700">
                                                {h.ott}
                                            </span>
                                        ) : null}
                                    </div>
                                    {h.note ? (
                                        <div className="mt-2 text-sm text-neutral-800">
                                            {renderBody(formatNoteInline(h.note))}
                                        </div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <CommentsPanel titleId={titleId} userId={userId} />
        </div>
    );
}
