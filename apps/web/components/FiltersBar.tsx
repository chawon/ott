"use client";

import { Status } from "@/lib/types";

export default function FiltersBar({
                                       status,
                                       setStatus,
                                       ott,
                                       setOtt,
                                   }: {
    status: Status | "ALL";
    setStatus: (s: Status | "ALL") => void;
    ott: string;
    setOtt: (s: string) => void;
}) {
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
                <div className="text-sm text-neutral-600">OTT</div>
                <input
                    value={ott}
                    onChange={(e) => setOtt(e.target.value)}
                    placeholder="예: Netflix"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none md:w-64"
                />
            </div>
        </div>
    );
}
