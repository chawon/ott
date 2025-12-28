import Link from "next/link";
import { WatchLog } from "@/lib/types";
import { formatNoteInline, occasionLabel, placeLabel, statusLabel } from "@/lib/utils";

function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function renderBody(text: string) {
    const parts = text.split(/(@\{[^}]+\})/g);
    return parts.map((p, idx) => {
        if (p.startsWith("@{") && p.endsWith("}")) {
            const name = p.slice(2, -1);
            return (
                <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
                    @{name}
                </span>
            );
        }
        if (p.startsWith("@")) {
            return (
                <span key={idx} className="rounded-md bg-indigo-50 px-1 text-indigo-700">
                    {p}
                </span>
            );
        }
        return <span key={idx}>{p}</span>;
    });
}

function chip(label: string, tone: "place" | "occasion") {
    const toneClass = tone === "place"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
    return (
        <span className={`rounded-full border px-3 py-1 text-xs ${toneClass}`}>
            {label}
        </span>
    );
}

export default function LogCard({ log }: { log: WatchLog }) {
    const t = log.title;
    if (!t?.id) return null;

    return (
        <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Link href={`/title/${t.id}`} className="text-base font-semibold hover:underline">
                        {t.name}
                    </Link>

                    <div className="mt-1 text-sm text-neutral-600">
                        {statusLabel(log.status)} · {formatDate(log.watchedAt ?? log.createdAt)}
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
                    {log.place ? chip(placeLabel(log.place), "place") : null}
                    {log.occasion ? chip(occasionLabel(log.occasion), "occasion") : null}
                </div>
            ) : null}

            {log.note ? (
                <p className="text-sm leading-relaxed text-neutral-800">
                    {renderBody(formatNoteInline(log.note))}
                </p>
            ) : null}
        </article>
    );
}
