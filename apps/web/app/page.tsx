"use client";

import { useEffect, useState } from "react";
import QuickLogCard from "@/components/QuickLogCard";
import LogCard from "@/components/LogCard";
import { api } from "@/lib/api";
import DiscussionList from "@/components/DiscussionList";
import { listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import { DiscussionListItem, WatchLog } from "@/lib/types";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

export default function HomePage() {
    const [logs, setLogs] = useState<WatchLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
    const { isRetro } = useRetro();

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

    if (isRetro) {
        return (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="space-y-10">
                    <section className="space-y-4">
                        <div className="bg-black inline-block px-3 py-1 text-sm font-bold uppercase tracking-widest text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                            빠른 기록
                        </div>
                        <QuickLogCard
                            onCreated={async (created) => {
                                setLogs((prev) => [created, ...prev].slice(0, 8));
                                await upsertLogsLocal([created]);
                                await loadDiscussions();
                            }}
                        />
                    </section>
                    
                    <section className="space-y-4">
                        <div className="flex items-baseline justify-between border-b-4 border-black pb-2">
                            <div className="text-xl font-bold uppercase tracking-tighter">나의 역사</div>
                            <a href="/timeline" className="text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white px-1 uppercase underline underline-offset-4">
                                전체 보기
                            </a>
                        </div>

                        {loading && logs.length === 0 ? (
                            <div className="border-4 border-black bg-white p-5 text-sm font-bold uppercase">
                                로딩 중...
                            </div>
                        ) : null}

                        {!loading && logs.length === 0 ? (
                            <div className="border-4 border-dashed border-neutral-400 bg-neutral-100 p-10 text-center text-sm font-bold uppercase text-neutral-500">
                                아직 기록이 없습니다. 위에서 모험을 시작하세요!
                            </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-6">
                            {logs.map((l) => (
                                <LogCard key={l.id} log={l} />
                            ))}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <section className="space-y-4">
                        <div className="flex items-baseline justify-between border-b-4 border-black pb-2">
                            <div className="text-lg font-bold uppercase tracking-tighter">실시간 수다</div>
                            <a href="/public" className="text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white px-1 uppercase underline underline-offset-4">
                                전체 보기
                            </a>
                        </div>
                        <DiscussionList items={discussions} />
                    </section>

                    <div className="nes-container is-dark p-4 mt-8">
                        <p className="text-[10px] font-bold leading-relaxed uppercase">
                            환영합니다, 모험가여. <br/>
                            OTT (On The Timeline)에서 당신의 여정을 기록하세요!
                        </p>
                    </div>
                </aside>
            </div>
        );
    }

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
