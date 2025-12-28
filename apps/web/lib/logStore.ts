import { WatchLog } from "@/lib/types";

const KEY = "watchlog.logs.v1";

export function loadLogs(fallback: WatchLog[] = []): WatchLog[] {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw) as WatchLog[];
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
}

export function saveLogs(logs: WatchLog[]): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(logs));
}
