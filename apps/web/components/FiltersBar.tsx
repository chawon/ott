"use client";

import { useEffect, useMemo, useState } from "react";
import { Status } from "@/lib/types";
import { cn, statusOptionsForType } from "@/lib/utils";

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
    "DVD",
    "블루레이",
    "CGV",
    "롯데시네마",
    "메가박스",
    "씨네Q",
] as const;

const OTT_GROUPS = [
    { label: "OTT", options: ["넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠"] },
    { label: "유료 방송", options: ["채널", "VOD"] },
    { label: "물리 매체", options: ["DVD", "블루레이"] },
    { label: "극장", options: ["CGV", "롯데시네마", "메가박스", "씨네Q"] },
] as const;

const OTT_CUSTOM_VALUE = "__custom__";
const OTT_CUSTOM_KEY = "watchlog.ott.custom";

function resolveOttSelect(value: string, options: string[]) {
    if (!value) return "";
    if (value.includes(",")) {
        const picked = value.split(",").map((v) => v.trim()).filter(Boolean);
        for (const group of OTT_GROUPS) {
            if (picked.length !== group.options.length) continue;
            const allMatch = picked.every((v) => (group.options as readonly string[]).includes(v));
            if (allMatch) return `__group:${group.label}`;
        }
        return OTT_CUSTOM_VALUE;
    }
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
                                       contentType,
                                       setContentType,
                                   }: {
    status: Status | "ALL";
    setStatus: (s: Status | "ALL") => void;
    ott: string;
    setOtt: (s: string) => void;
    origin: "ALL" | "LOG" | "COMMENT";
    setOrigin: (s: "ALL" | "LOG" | "COMMENT") => void;
    contentType: "ALL" | "video" | "book";
    setContentType: (s: "ALL" | "video" | "book") => void;
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

    useEffect(() => {
        if (contentType !== "video") {
            setOttSelect("");
        }
    }, [contentType]);

    const statusOptions = useMemo(() => {
        if (contentType === "book") return statusOptionsForType("book");
        return statusOptionsForType("movie");
    }, [contentType]);

    const disableStatus = contentType === "ALL";

    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">콘텐츠</div>
                <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as "ALL" | "video" | "book")}
                    className="select-base rounded-xl px-3 py-2 text-sm"
                >
                    <option value="ALL">전체</option>
                    <option value="video">영상</option>
                    <option value="book">책</option>
                </select>
            </div>
            <div className="flex items-center gap-2">
                <div className={cn("text-sm font-semibold", disableStatus ? "text-muted-foreground" : "text-foreground")}>필터</div>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className={cn(
                        "select-base rounded-xl px-3 py-2 text-sm",
                        disableStatus
                            ? "!text-muted-foreground bg-muted/60 opacity-60"
                            : "text-foreground font-semibold"
                    )}
                    disabled={disableStatus}
                >
                    <option value="ALL">전체</option>
                    {!disableStatus ? (
                        statusOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))
                    ) : null}
                </select>
            </div>

            <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">구분</div>
                <select
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value as "ALL" | "LOG" | "COMMENT")}
                    className="select-base rounded-xl px-3 py-2 text-sm"
                >
                    <option value="ALL">전체</option>
                    <option value="LOG">내 기록</option>
                    <option value="COMMENT">코멘트</option>
                </select>
            </div>

            {contentType === "video" ? (
                <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">OTT</div>
                    <div className="w-full md:w-64">
                        <select
                            value={ottSelect}
                            onChange={(e) => {
                                const next = e.target.value;
                                setOttSelect(next);
                                if (next === OTT_CUSTOM_VALUE) {
                                    setOtt("");
                                } else if (next.startsWith("__group:")) {
                                    const label = next.replace("__group:", "");
                                    const group = OTT_GROUPS.find((g) => g.label === label);
                                    setOtt(group ? group.options.join(",") : "");
                                } else {
                                    setOtt(next);
                                }
                            }}
                            className="w-full select-base rounded-xl px-3 py-2 text-sm"
                        >
                            <option value="">전체</option>
                            <optgroup label="그룹">
                                {OTT_GROUPS.map((g) => (
                                    <option key={g.label} value={`__group:${g.label}`}>
                                        {g.label} 전체
                                    </option>
                                ))}
                            </optgroup>
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
                                className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}

            {contentType === "book" ? (
                <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">구매처/소장</div>
                    <div className="w-full md:w-64">
                        <input
                            value={ott}
                            onChange={(e) => setOtt(e.target.value)}
                            placeholder="예: 교보문고, 리디북스, 도서관"
                            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
                        />
                    </div>
                </div>
            ) : null}
        </div>
    );
}
