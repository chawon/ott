"use client";

import { useEffect, useState } from "react";
import QuickLogCard from "@/components/QuickLogCard";
import LogCard from "@/components/LogCard";
import { api } from "@/lib/api";
import DiscussionList from "@/components/DiscussionList";
import { listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { DiscussionListItem, WatchLog } from "@/lib/types";

export default function HomePage() {
    const [logs, setLogs] = useState<WatchLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);

    async function loadDiscussions() {
        try {
            const latest = await api<DiscussionListItem[]>("/discussions/latest?limit=6");
            setDiscussions(latest);
        } catch {
            setDiscussions([]);
        }
    }

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const cached = await listLogsLocal({ limit: 8 });
                if (cached.length > 0) setLogs(cached);

                const l = await api<WatchLog[]>("/logs?limit=8");
                setLogs(l);
                await upsertLogsLocal(l);
            } catch {
                // keep cached logs if network fails
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        loadDiscussions();
    }, []);

    useEffect(() => {
        function handleSync() {
            listLogsLocal({ limit: 8 }).then((cached) => setLogs(cached));
            loadDiscussions();
        }
        window.addEventListener("sync:updated", handleSync);
        return () => window.removeEventListener("sync:updated", handleSync);
    }, []);

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
                <section className="space-y-3">
                    <div className="text-base font-semibold">빠르게 기록 남기기</div>
                    <QuickLogCard
                        onCreated={async (created) => {
                            setLogs((prev) => [created, ...prev].slice(0, 8));
                            await upsertLogsLocal([created]);
                            await loadDiscussions();
                        }}
                    />
                </section>
                <section className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <div className="text-base font-semibold">나의 기록</div>
                        <a href="/timeline" className="text-sm text-neutral-700 hover:underline">
                            전체 보기
                        </a>
                    </div>

                    {loading && logs.length === 0 ? (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 shadow-sm">
                            Loading…
                        </div>
                    ) : null}

                    {!loading && logs.length === 0 ? (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 shadow-sm">
                            아직 기록이 없어요. 위에서 하나 저장해봐.
                        </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-3">
                        {logs.map((l) => (
                            <LogCard key={l.id} log={l} />
                        ))}
                    </div>
                </section>
            </div>

            <aside className="space-y-3">
                <div className="flex items-baseline justify-between">
                    <div className="text-base font-semibold">요즘 함께 하는 기록들</div>
                    <a href="/public" className="text-sm text-neutral-700 hover:underline">
                        전체 보기
                    </a>
                </div>
                <DiscussionList items={discussions} />
            </aside>
        </div>
    );
}
