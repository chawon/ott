"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, PencilLine, NotebookPen } from "lucide-react";
import QuickLogCard from "@/components/QuickLogCard";
import LogCard from "@/components/LogCard";
import ShareBottomSheet from "@/components/ShareBottomSheet";
import FirstLogOnboardingOverlay from "@/components/FirstLogOnboardingOverlay";
import { api } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import DiscussionList from "@/components/DiscussionList";
import { listLogsLocal, upsertLogsLocal } from "@/lib/localStore";
import type { DiscussionListItem, WatchLog } from "@/lib/types";
import { useRetro } from "@/context/RetroContext";

const ONBOARDING_COMPLETED_KEY = "watchlog.onboarding.firstLog.completed";
const ONBOARDING_SKIPPED_KEY = "watchlog.onboarding.firstLog.skipped";

export default function HomePage() {
    const [logs, setLogs] = useState<WatchLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [bootstrapped, setBootstrapped] = useState(false);
    const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
    const [quickOpen, setQuickOpen] = useState(true);
    const [quickType, setQuickType] = useState<"video" | "book">("video");
    const [shareOpen, setShareOpen] = useState(false);
    const [shareLog, setShareLog] = useState<WatchLog | null>(null);
    const [onboardingOpen, setOnboardingOpen] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1);
    const [onboardingTypePicked, setOnboardingTypePicked] = useState(false);
    const onboardingViewTrackedRef = useRef(false);
    const { isRetro } = useRetro();

    async function loadDiscussions() {
        try {
            const latest = await api<DiscussionListItem[]>("/discussions/latest?limit=6&days=14");
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
                await upsertLogsLocal(l);
                const refreshed = await listLogsLocal({ limit: 8 });
                if (refreshed.length > 0) setLogs(refreshed);
            } catch {
                // keep cached logs if network fails
            } finally {
                setLoading(false);
                setBootstrapped(true);
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

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (isRetro) return;
        if (!bootstrapped) return;
        if (loading) return;
        if (logs.length > 0 && !(onboardingOpen && onboardingStep === 4)) {
            setOnboardingOpen(false);
            return;
        }
        if (onboardingOpen) {
            if (!quickOpen) setQuickOpen(true);
            return;
        }
        const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "1";
        const skipped = localStorage.getItem(ONBOARDING_SKIPPED_KEY) === "1";
        if (completed || skipped) {
            setOnboardingOpen(false);
            return;
        }
        setOnboardingOpen(true);
        setOnboardingStep(1);
        setOnboardingTypePicked(false);
        if (!quickOpen) setQuickOpen(true);
    }, [bootstrapped, isRetro, loading, logs.length, quickOpen, onboardingOpen, onboardingStep]);

    function completeOnboarding() {
        if (typeof window !== "undefined") {
            localStorage.setItem(ONBOARDING_COMPLETED_KEY, "1");
        }
        void trackEvent("onboarding_first_log_complete", {
            step: onboardingStep,
            contentTypePicked: onboardingTypePicked,
        });
        setOnboardingOpen(false);
    }

    function skipOnboarding() {
        if (typeof window !== "undefined") {
            localStorage.setItem(ONBOARDING_SKIPPED_KEY, "1");
        }
        void trackEvent("onboarding_first_log_skip", {
            step: onboardingStep,
            contentTypePicked: onboardingTypePicked,
        });
        setOnboardingOpen(false);
    }

    useEffect(() => {
        if (!onboardingOpen) return;
        if (onboardingViewTrackedRef.current) return;
        onboardingViewTrackedRef.current = true;
        void trackEvent("onboarding_first_log_view", {
            step: onboardingStep,
        });
    }, [onboardingOpen, onboardingStep]);

    if (isRetro) {
        return (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="space-y-10">
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h1 className="bg-black inline-block px-3 py-1 text-sm font-bold uppercase tracking-widest text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                                    봤니? 그럼 날적이 해보자~
                                </h1>
                                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-tight">
                                    한 번 적어 두면 발자취가 또렷해져요
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQuickOpen((v) => !v)}
                                className="border-2 border-black px-2 py-1 text-xs font-bold uppercase"
                                aria-expanded={quickOpen}
                            >
                                {quickOpen ? "접기" : "펼치기"}
                            </button>
                        </div>
                        {quickOpen ? (
                            <QuickLogCard
                                onCreated={async (created, options) => {
                                    setLogs((prev) => [created, ...prev].slice(0, 8));
                                    if (onboardingOpen) {
                                        setOnboardingStep(4);
                                        void trackEvent("onboarding_first_log_step_next", {
                                            fromStep: onboardingStep,
                                            toStep: 4,
                                            reason: "log_saved",
                                        });
                                    }
                                    await upsertLogsLocal([created]);
                                    await loadDiscussions();
                                    if (options?.shareCard) {
                                        setShareLog(created);
                                        setShareOpen(true);
                                    }
                                }}
                                onContentTypeChange={setQuickType}
                                onContentTypePicked={() => {
                                    setOnboardingTypePicked(true);
                                    if (onboardingOpen && onboardingStep === 1) {
                                        setOnboardingStep(2);
                                        void trackEvent("onboarding_first_log_step_next", {
                                            fromStep: 1,
                                            toStep: 2,
                                            reason: "content_type_picked",
                                        });
                                    }
                                }}
                                initialContentType={quickType}
                            />
                        ) : null}
                    </section>
                    
                    <section className="space-y-4">
                        <div className="flex items-baseline justify-between border-b-4 border-black pb-2">
                            <div className="text-xl font-bold uppercase tracking-tighter">나의 발자취</div>
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
                                아직 발자취가 없어. 위에서 날적이 하나 남겨봐~
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
                                        <p className="text-[12px] font-bold leading-relaxed uppercase">
                                            환영합니다, 그대여. <br/>
                                            <br/>
                                            으뜸과 버금에서 당신의 비디오를 찾아보세요!
                                        </p>
                                    </div>                </aside>
                <ShareBottomSheet
                    open={shareOpen}
                    log={shareLog}
                    onClose={() => setShareOpen(false)}
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
                <section className="space-y-3">
                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                                <h1 className="text-xl font-semibold flex items-center gap-2">
                                    <PencilLine className="h-4 w-4" />
                                    {quickType === "book" ? "나의 책 기록" : "나의 영상 기록"}
                                </h1>
                                <p className="text-sm text-muted-foreground ml-6">
                                    한 줄만 적어두면 타임라인이 쌓여요
                                </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setQuickOpen((v) => !v)}
                            className="text-sm font-medium text-muted-foreground hover:text-foreground"
                            aria-expanded={quickOpen}
                        >
                            {quickOpen ? "접기" : "펼치기"}
                        </button>
                    </div>
                    {quickOpen ? (
                        <QuickLogCard
                            onCreated={async (created, options) => {
                                setLogs((prev) => [created, ...prev].slice(0, 8));
                                if (onboardingOpen) {
                                    setOnboardingStep(4);
                                    void trackEvent("onboarding_first_log_step_next", {
                                        fromStep: onboardingStep,
                                        toStep: 4,
                                        reason: "log_saved",
                                    });
                                }
                                await upsertLogsLocal([created]);
                                await loadDiscussions();
                                if (options?.shareCard) {
                                    setShareLog(created);
                                    setShareOpen(true);
                                }
                            }}
                            onContentTypeChange={setQuickType}
                            onContentTypePicked={() => {
                                setOnboardingTypePicked(true);
                                if (onboardingOpen && onboardingStep === 1) {
                                    setOnboardingStep(2);
                                    void trackEvent("onboarding_first_log_step_next", {
                                        fromStep: 1,
                                        toStep: 2,
                                        reason: "content_type_picked",
                                    });
                                }
                            }}
                            initialContentType={quickType}
                        />
                    ) : null}
                </section>
                <section className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <div className="text-base font-semibold flex items-center gap-2">
                            <NotebookPen className="h-4 w-4" />
                            나의 기록
                        </div>
                        <a href="/timeline" className="text-sm text-neutral-700 hover:underline">
                            전체 보기
                        </a>
                    </div>

                    {loading && logs.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                            불러오는 중…
                        </div>
                    ) : null}

                    {!loading && logs.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                            첫 기록을 남겨보세요. 타임라인이 바로 시작돼요.
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
                <div className="flex items-end justify-between min-h-[52px]">
                    <div className="text-base font-semibold flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        요즘 함께 하는 기록들
                    </div>
                    <a href="/public" className="text-sm text-neutral-700 hover:underline">
                        전체 보기
                    </a>
                </div>
                <DiscussionList items={discussions} />
            </aside>
            <ShareBottomSheet
                open={shareOpen}
                log={shareLog}
                onClose={() => setShareOpen(false)}
            />
            <FirstLogOnboardingOverlay
                open={onboardingOpen}
                step={onboardingStep}
                contentTypePicked={onboardingTypePicked}
                onPrev={() => setOnboardingStep((prev) => (prev === 1 ? 1 : ((prev - 1) as 1 | 2 | 3 | 4)))}
                onNext={() => {
                    const toStep = onboardingStep === 4 ? 4 : ((onboardingStep + 1) as 1 | 2 | 3 | 4);
                    setOnboardingStep(toStep);
                    void trackEvent("onboarding_first_log_step_next", {
                        fromStep: onboardingStep,
                        toStep,
                        reason: "manual_next",
                    });
                }}
                onSkip={skipOnboarding}
                onComplete={completeOnboarding}
            />
        </div>
    );
}
