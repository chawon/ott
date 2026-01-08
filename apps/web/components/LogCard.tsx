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

export default function LogCard({ log }: { log: WatchLog }) {
    const t = log.title;
    const { isRetro } = useRetro();
    if (!t?.id) return null;

    if (isRetro) {
        return (
            <article className="nes-container hover:bg-neutral-50 transition-none">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <Link href={`/title/${t.id}`} className="text-lg font-bold hover:text-red-600 hover:underline decoration-2 underline-offset-4">
                            {t.name}
                        </Link>
                        <div className="mt-1 text-sm text-neutral-600 font-bold uppercase flex gap-2">
                            <span className="bg-black text-white px-1">{statusLabel(log.status)}</span>
                            <span>{formatDate(log.watchedAt ?? log.createdAt, true)}</span>
                            {log.ott ? <span className="text-blue-600">@{log.ott}</span> : ""}
                        </div>
                    </div>
                    {typeof log.rating === "number" ? (
                        <div className="bg-black px-2 py-1 text-sm font-bold text-yellow-400 border-2 border-yellow-400">
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
                    <div className="border-t-2 border-dashed border-neutral-300 pt-3 mt-2">
                        <p className="text-sm leading-relaxed text-neutral-900">{renderBody(formatNoteInline(log.note), true)}</p>
                    </div>
                ) : null}
            </article>
        );
    }

    return (
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Link href={`/title/${t.id}`} className="text-base font-semibold hover:underline">
                        {t.name}
                    </Link>
                    <div className="mt-1 text-sm text-neutral-600">
                        {statusLabel(log.status)} · {formatDate(log.watchedAt ?? log.createdAt, false)}
                        {log.ott ? ` · ${log.ott}` : ""}
                    </div>
                </div>
                {typeof log.rating === "number" ? (
                    <div className="rounded-xl bg-neutral-900 px-3 py-1 text-sm font-semibold text-white">
                        {log.rating.toFixed(1)}
                    </div>
                ) : null}
            </div>
            {(log.place || log.occasion) ? (
                <div className="flex flex-wrap gap-2">
                    {log.place ? chip(placeLabel(log.place), "place", false) : null}
                    {log.occasion ? chip(occasionLabel(log.occasion), "occasion", false) : null}
                </div>
            ) : null}
            {log.note ? (
                <p className="text-sm leading-relaxed text-neutral-800">
                    {renderBody(formatNoteInline(log.note), false)}
                </p>
            ) : null}
        </article>
    );
}
