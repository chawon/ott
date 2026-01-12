"use client";

import { useEffect, useMemo, useState } from "react";
import FiltersBar from "@/components/FiltersBar";
import LogCard from "@/components/LogCard";
import { api } from "@/lib/api";
import { listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { Status, WatchLog } from "@/lib/types";

function buildQuery(params: Record<string, string | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v && v.trim()) qs.set(k, v.trim());
    }
    const s = qs.toString();
    return s ? `?${s}` : "";
}

function applyFilters(logs: WatchLog[], status: Status | "ALL", ott: string) {
    return logs.filter((l) => {
        if (status !== "ALL" && l.status !== status) return false;
        if (ott && ott.trim()) {
            if (!l.ott) return false;
            if (!l.ott.toLowerCase().includes(ott.trim().toLowerCase())) return false;
        }
        return true;
    });
}

export default function TimelinePage() {
    const [status, setStatus] = useState<Status | "ALL">("ALL");
    const [ott, setOtt] = useState("");
    const [logs, setLogs] = useState<WatchLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const timer = setTimeout(async () => {
            setLoading(true);
            setErr(null);
            let hadLocal = false;

            try {
                const cached = await listLogsLocal({
                    limit: 50,
                    status: status === "ALL" ? undefined : status,
                    ott: ott.trim() ? ott : undefined,
                });
                if (!cancelled) {
                    if (cached.length > 0) hadLocal = true;
                    setLogs(cached);
                }

                const query = buildQuery({
                    limit: "50",
                    status: status === "ALL" ? undefined : status,
                    ott: ott.trim() ? ott : undefined,
                });

                const res = await api<WatchLog[]>(`/logs${query}`);
                const filtered = applyFilters(res, status, ott);
                if (!cancelled) setLogs(filtered);
                await upsertLogsLocal(res);
            } catch (e: any) {
                if (!cancelled) {
                    setErr(e?.message ?? "Failed to load logs");
                    if (!hadLocal) setLogs([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [status, ott]);

    useEffect(() => {
        function handleSync() {
            listLogsLocal({
                limit: 50,
                status: status === "ALL" ? undefined : status,
                ott: ott.trim() ? ott : undefined,
            }).then((cached) => setLogs(cached));
        }
        window.addEventListener("sync:updated", handleSync);
        return () => window.removeEventListener("sync:updated", handleSync);
    }, [status, ott]);

    const headerSubtitle = useMemo(() => {
        if (loading) return "불러오는 중…";
        if (err) return err;
        return "전체 기록";
    }, [loading, err]);

    return (
        <div className="space-y-4">
            <div>
                <div className="text-xl font-semibold">나의 기록</div>
                <div className="text-sm text-neutral-600">{headerSubtitle}</div>
            </div>

            <FiltersBar status={status} setStatus={setStatus} ott={ott} setOtt={setOtt} />

            {loading && logs.length === 0 && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 shadow-sm">
                    Loading…
                </div>
            )}

            {!loading && logs.length === 0 && !err && (
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 shadow-sm">
                    아직 기록이 없어요. Home에서 하나 저장해봐.
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {logs.map((l) => (
                    <LogCard key={l.id} log={l} />
                ))}
            </div>
        </div>
    );
}
