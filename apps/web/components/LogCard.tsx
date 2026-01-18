import Link from "next/link";
import { WatchLog } from "@/lib/types";
import { formatNoteInline, occasionLabel, placeLabel, statusLabel } from "@/lib/utils";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

function formatDate(iso: string, isRetro: boolean) {
    const d = new Date(iso);
    if (isRetro) {
        return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\. /g, '-').replace('.', '');
    }
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function renderBody(text: string, isRetro: boolean) {
    const parts = text.split(/(@\{[^}]+\})/g);
    return parts.map((p, idx) => {
        if (p.startsWith("@{") && p.endsWith("}")) {
            const name = p.slice(2, -1);
            return (
                <span key={idx} className={cn(
                    isRetro ? "bg-blue-100 text-blue-800 px-1 border border-blue-800 mx-0.5" : "rounded-md bg-indigo-50 px-1 text-indigo-700"
                )}>
                    @{name}
                </span>
            );
        }
        if (p.startsWith("@")) {
            return (
                <span key={idx} className={cn(
                    isRetro ? "bg-blue-100 text-blue-800 px-1 border border-blue-800 mx-0.5" : "rounded-md bg-indigo-50 px-1 text-indigo-700"
                )}>
                    {p}
                </span>
            );
        }
        return <span key={idx}>{p}</span>;
    });
}

function chip(label: string, tone: "place" | "occasion", isRetro: boolean) {
    if (isRetro) {
        const toneClass = tone === "place" ? "bg-[#2ecc71] text-white border-black" : "bg-[#f7d51d] text-black border-black";
        return <span className={`border-2 px-2 py-0 text-xs font-bold ${toneClass}`}>{label}</span>;
    }
    const toneClass = tone === "place" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200";
    return <span className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>{label}</span>;
}

function seasonEpisodeLabel(log: WatchLog) {
    if (typeof log.seasonNumber !== "number") return null;
    if (typeof log.episodeNumber === "number") {
        return `S${log.seasonNumber} · E${log.episodeNumber}`;
    }
    return `S${log.seasonNumber}`;
}

function seasonYearLabel(log: WatchLog) {
    if (typeof log.seasonYear === "number") return String(log.seasonYear);
    return null;
}

export default function LogCard({ log }: { log: WatchLog }) {
    const t = log.title;
    const { isRetro } = useRetro();
    if (log.deletedAt) return null;
    if (!t?.id) return null;
    const seasonLabel = seasonEpisodeLabel(log);
    const yearLabel = seasonYearLabel(log) ?? (t.year ? String(t.year) : null);
    const isCommentOrigin = log.origin === "COMMENT";

    if (isRetro) {
        return (
            <article className={cn(
                "nes-container hover:bg-neutral-50 transition-none flex gap-6",
                isCommentOrigin && "bg-[#fff7e6] border-4 border-[#f59e0b]"
            )}>
                <div className="shrink-0">
                <div className="h-40 w-28 border-4 border-black bg-neutral-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        {(log.seasonPosterUrl ?? t.posterUrl) ? (
                            <img
                                src={log.seasonPosterUrl ?? t.posterUrl ?? ""}
                                alt={t.name}
                                className="h-full w-full object-cover pixelated"
                                style={{ imageRendering: "pixelated" }}
                                loading="lazy"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-neutral-400 font-bold text-center p-2 uppercase">NO IMAGE</div>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                            <Link href={`/title/${t.id}`} className="text-xl font-bold hover:text-red-600 hover:underline decoration-2 underline-offset-4 truncate block">
                                {t.name}
                            </Link>
                            <div className="mt-1 text-sm text-neutral-600 font-bold uppercase flex flex-wrap gap-2">
                                <span className="bg-black text-white px-1">{statusLabel(log.status)}</span>
                                {seasonLabel ? <span className="bg-white text-black px-1 border border-black">{seasonLabel}</span> : null}
                                {yearLabel ? <span>{yearLabel}</span> : null}
                                <span>{formatDate(log.watchedAt ?? log.createdAt, true)}</span>
                                {log.ott ? <span className="text-blue-600">@{log.ott}</span> : ""}
                            </div>
                        </div>
                        {typeof log.rating === "number" ? (
                            <div className="shrink-0 bg-black px-2 py-1 text-sm font-bold text-yellow-400 border-2 border-yellow-400">
                                ★ {log.rating.toFixed(1)}
                            </div>
                        ) : null}
                    </div>
                    {(log.place || log.occasion) ? (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {log.place ? chip(placeLabel(log.place), "place", true) : null}
                            {log.occasion ? chip(occasionLabel(log.occasion), "occasion", true) : null}
                        </div>
                    ) : null}
                    {log.note ? (
                        <div className="border-t-2 border-dashed border-neutral-300 pt-3 mt-auto">
                            <p className="text-sm leading-relaxed text-neutral-900 line-clamp-3">{renderBody(formatNoteInline(log.note), true)}</p>
                        </div>
                    ) : null}
                </div>
            </article>
        );
    }

    return (
        <article className={cn(
            "rounded-2xl border bg-white p-5 shadow-sm transition-all flex gap-5",
            isCommentOrigin ? "border-amber-300 bg-amber-50/40" : "border-neutral-200 hover:border-neutral-300"
        )}>
            <div className="shrink-0">
                <div className="h-32 w-20 overflow-hidden rounded-xl bg-neutral-100 shadow-sm border border-neutral-100">
                    {(log.seasonPosterUrl ?? t.posterUrl) ? (
                        <img
                            src={log.seasonPosterUrl ?? t.posterUrl ?? ""}
                            alt={t.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-[10px] text-neutral-400 font-medium">NO IMAGE</div>
                    )}
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0">
                        <Link href={`/title/${t.id}`} className="text-lg font-bold text-neutral-900 hover:underline decoration-neutral-400 underline-offset-4 truncate block">
                            {t.name}
                        </Link>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                            <span>{statusLabel(log.status)}</span>
                            {seasonLabel ? (
                                <>
                                    <span className="text-neutral-300">·</span>
                                    <span>{seasonLabel}</span>
                                </>
                            ) : null}
                            {yearLabel ? (
                                <>
                                    <span className="text-neutral-300">·</span>
                                    <span>{yearLabel}</span>
                                </>
                            ) : null}
                            <span className="text-neutral-300">·</span>
                            <span>{formatDate(log.watchedAt ?? log.createdAt, false)}</span>
                            {log.ott ? (
                                <>
                                    <span className="text-neutral-300">·</span>
                                    <span className="text-indigo-600/80">{log.ott}</span>
                                </>
                            ) : null}
                        </div>
                    </div>
                    {typeof log.rating === "number" ? (
                        <div className="shrink-0 rounded-xl bg-neutral-900 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                            {log.rating.toFixed(1)}
                        </div>
                    ) : null}
                </div>
                {(log.place || log.occasion) ? (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {log.place ? chip(placeLabel(log.place), "place", false) : null}
                        {log.occasion ? chip(occasionLabel(log.occasion), "occasion", false) : null}
                    </div>
                ) : null}
                {log.note ? (
                    <p className="text-sm leading-relaxed text-neutral-700 line-clamp-2">
                        {renderBody(formatNoteInline(log.note), false)}
                    </p>
                ) : null}
            </div>
        </article>
    );
}
