"use client";

import { useEffect, useMemo, useState } from "react";
import { Status } from "@/lib/types";

const OTT_OPTIONS = [
    "넷플릭스",
    "디즈니플러스",
    "티빙",
    "웨이브",
    "쿠팡플레이",
    "애플티비",
    "프라임비디오",
    "왓챠",
    "채널",
    "VOD",
    "CGV",
    "롯데시네마",
    "메가박스",
    "씨네Q",
] as const;

const OTT_GROUPS = [
    { label: "OTT", options: ["넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠"] },
    { label: "유료방송", options: ["채널", "VOD"] },
    { label: "극장", options: ["CGV", "롯데시네마", "메가박스", "씨네Q"] },
] as const;

const OTT_CUSTOM_VALUE = "__custom__";
const OTT_CUSTOM_KEY = "watchlog.ott.custom";

function resolveOttSelect(value: string, options: string[]) {
    if (!value) return "";
    return options.includes(value) ? value : OTT_CUSTOM_VALUE;
}

function loadCustomOttOptions(): string[] {
    if (typeof localStorage === "undefined") return [];
    try {
        const raw = localStorage.getItem(OTT_CUSTOM_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
    } catch {
        return [];
    }
}

export default function FiltersBar({
                                       status,
                                       setStatus,
                                       ott,
                                       setOtt,
                                       origin,
                                       setOrigin,
                                   }: {
    status: Status | "ALL";
    setStatus: (s: Status | "ALL") => void;
    ott: string;
    setOtt: (s: string) => void;
    origin: "ALL" | "LOG" | "COMMENT";
    setOrigin: (s: "ALL" | "LOG" | "COMMENT") => void;
}) {
    const [ottSelect, setOttSelect] = useState<string>("");
    const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);

    const allOttOptions = useMemo(() => {
        const base = Array.from(OTT_OPTIONS) as string[];
        const extras = customOttOptions.filter((v) => !base.includes(v));
        return [...base, ...extras];
    }, [customOttOptions]);

    useEffect(() => {
        setCustomOttOptions(loadCustomOttOptions());
    }, []);

    useEffect(() => {
        if (ottSelect === OTT_CUSTOM_VALUE) return;
        setOttSelect(resolveOttSelect(ott, allOttOptions));
    }, [ott, ottSelect, allOttOptions]);

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
                <div className="text-sm font-medium">필터</div>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                >
                    <option value="ALL">전체</option>
                    <option value="DONE">봤어요</option>
                    <option value="IN_PROGRESS">보는 중</option>
                    <option value="WISHLIST">보고 싶어요</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <div className="text-sm text-neutral-600">구분</div>
                <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value as "ALL" | "LOG" | "COMMENT")}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                >
                    <option value="ALL">전체</option>
                    <option value="LOG">내 기록</option>
                    <option value="COMMENT">코멘트</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <div className="text-sm text-neutral-600">OTT</div>
                <div className="w-full md:w-64">
                    <select
                        value={ottSelect}
                        onChange={(e) => {
                            const next = e.target.value;
                            setOttSelect(next);
                            if (next === OTT_CUSTOM_VALUE) {
                                setOtt("");
                            } else {
                                setOtt(next);
                            }
                        }}
                        className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                    >
                        <option value="">전체</option>
                        {OTT_GROUPS.map((g) => (
                            <optgroup key={g.label} label={g.label}>
                                {g.options.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </optgroup>
                        ))}
                        {customOttOptions.length > 0 ? (
                            <optgroup label="내 입력">
                                {customOttOptions.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </optgroup>
                        ) : null}
                        <option value={OTT_CUSTOM_VALUE}>직접 입력</option>
                    </select>
                    {ottSelect === OTT_CUSTOM_VALUE ? (
                        <input
                            value={ott}
                            onChange={(e) => setOtt(e.target.value)}
                            placeholder="직접 입력"
                            className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                    ) : null}
                </div>
            </div>
        </div>
    );
}
