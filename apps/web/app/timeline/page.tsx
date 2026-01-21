"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import FiltersBar from "@/components/FiltersBar";
import LogCard from "@/components/LogCard";
import { api } from "@/lib/api";
import { listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { Status, WatchLog } from "@/lib/types";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

function buildQuery(params: Record<string, string | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v && v.trim()) qs.set(k, v.trim());
    }
    const s = qs.toString();
    return s ? `?${s}` : "";
}

export default function TimelinePage() {
    const { isRetro } = useRetro();
    const [status, setStatus] = useState<Status | "ALL">("ALL");
    const [origin, setOrigin] = useState<"ALL" | "LOG" | "COMMENT">("ALL");
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
                    origin: origin === "ALL" ? undefined : origin,
                    ott: ott.trim() ? ott : undefined,
                });
                if (!cancelled) {
                    if (cached.length > 0) hadLocal = true;
                    setLogs(cached);
                }

                const query = buildQuery({
                    limit: "50",
                    status: status === "ALL" ? undefined : status,
                    origin: origin === "ALL" ? undefined : origin,
                    ott: ott.trim() ? ott : undefined,
                });

                const res = await api<WatchLog[]>(`/logs${query}`);
                await upsertLogsLocal(res);
                const refreshed = await listLogsLocal({
                    limit: 50,
                    status: status === "ALL" ? undefined : status,
                    origin: origin === "ALL" ? undefined : origin,
                    ott: ott.trim() ? ott : undefined,
                });
                if (!cancelled) setLogs(refreshed);
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
    }, [status, ott, origin]);

    useEffect(() => {
        function handleSync() {
            listLogsLocal({
                limit: 50,
                status: status === "ALL" ? undefined : status,
                origin: origin === "ALL" ? undefined : origin,
                ott: ott.trim() ? ott : undefined,
            }).then((cached) => setLogs(cached));
        }
        window.addEventListener("sync:updated", handleSync);
        return () => window.removeEventListener("sync:updated", handleSync);
    }, [status, ott, origin]);

    const headerTitle = isRetro ? "발자취" : "나의 타임라인";
    const headerSubtitle = useMemo(() => {
        if (loading) return "불러오는 중…";
        if (err) return err;
        return isRetro ? "내가 남긴 날적이가 한눈에 보여요" : "내가 본 것들이 시간 순서로 모여요";
    }, [loading, err, isRetro]);

    return (
        <div className="space-y-4">
            <div>
                {isRetro ? (
                    <div className="flex items-baseline justify-between border-b-4 border-black pb-2 mb-4">
                        <div className="text-xl font-bold uppercase tracking-tighter">{headerTitle}</div>
                    </div>
                ) : (
                    <div className="text-xl font-semibold flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {headerTitle}
                    </div>
                )}
                <div className={cn(
                    isRetro ? "text-xs font-bold text-neutral-500 uppercase" : "text-sm text-muted-foreground"
                )}>
                    {headerSubtitle}
                </div>
            </div>

            <FiltersBar status={status} setStatus={setStatus} origin={origin} setOrigin={setOrigin} ott={ott} setOtt={setOtt} />

            {loading && logs.length === 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                    Loading…
                </div>
            )}

            {!loading && logs.length === 0 && !err && (
                <div className={cn(
                    "p-10 text-center text-sm font-bold shadow-sm",
                    isRetro 
                        ? "border-4 border-dashed border-neutral-400 bg-neutral-100 text-neutral-500 uppercase" 
                        : "rounded-2xl border border-border bg-card text-muted-foreground"
                )}>
                    {isRetro 
                        ? "아직 발자취가 없어. 위에서 날적이 하나 남겨봐~" 
                        : "첫 기록을 남겨보세요. 타임라인이 바로 시작돼요."}
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
