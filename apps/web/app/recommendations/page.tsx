"use client";

import { useEffect, useState } from "react";
import RecoShelf from "@/components/RecoShelf";
import { api } from "@/lib/api";
import { Title } from "@/lib/types";

type RecoResponse = { items: Title[]; reason: string };

export default function RecommendationsPage() {
    const [items, setItems] = useState<Title[]>([]);
    const [reason, setReason] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setErr(null);
            try {
                const res = await api<RecoResponse>("/recommendations?limit=20");
                setItems(res.items);
                setReason(res.reason);
            } catch (e: any) {
                setErr(e?.message ?? "Failed to load recommendations");
                setItems([]);
                setReason("");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return (
        <div className="space-y-4">
            <div>
                <div className="text-xl font-semibold">Recommendations</div>
                <div className="text-sm text-neutral-600">
                    {loading ? "불러오는 중…" : err ? err : (reason ? `Reason: ${reason}` : "추천 목록")}
                </div>
            </div>

            <RecoShelf
                title="For you"
                subtitle="최근 기록 기반 추천"
                items={items.slice(0, 10)}
            />

            <RecoShelf
                title="More picks"
                subtitle="추가 추천"
                items={items.slice(10, 20)}
            />
        </div>
    );
}
