"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { ensureAuth, pairWithCode } from "@/lib/auth";
import { getDeviceId, getPairingCode, getUserId, resetLocalState } from "@/lib/localStore";
import { api } from "@/lib/api";
import { useRetro } from "@/context/RetroContext";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const { isRetro } = useRetro();
  const [userId, setUserId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [devices, setDevices] = useState<{ id: string; createdAt: string; lastSeenAt: string; os?: string | null; browser?: string | null }[]>([]);

  useEffect(() => {
    (async () => {
      setInitializing(true);
      setStatus(null);
      try {
        const res = await ensureAuth();
        setUserId(res?.userId ?? getUserId());
        setDeviceId(res?.deviceId ?? getDeviceId());
        setPairingCode(res?.pairingCode ?? getPairingCode());
        if (!res) setStatus("페어링 코드 발급에 실패했어요. 다시 시도해 주세요.");
        await loadDevices();
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  async function pair() {
    if (!input.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await pairWithCode(input.trim());
      setUserId(res.userId);
      setDeviceId(res.deviceId);
      setPairingCode(res.pairingCode);
      setInput("");
      setStatus("연결 완료");
      await loadDevices();
    } catch (e: any) {
      setStatus(e?.message ?? "연결 실패");
    } finally {
      setLoading(false);
    }
  }

  async function loadDevices() {
    try {
      const res = await api<{ id: string; createdAt: string; lastSeenAt: string; os?: string | null; browser?: string | null }[]>(
        "/auth/devices"
      );
      setDevices(res);
      return res;
    } catch {
      setDevices([]);
      return [];
    }
  }

  async function resetIdentity() {
    await resetLocalState();
    const res = await ensureAuth();
    setUserId(res?.userId ?? getUserId());
    setDeviceId(res?.deviceId ?? getDeviceId());
    setPairingCode(res?.pairingCode ?? getPairingCode());
    await loadDevices();
  }

  async function revokeDevice(targetId: string) {
    setLoading(true);
    setStatus(null);
    try {
      await api(`/auth/devices/${targetId}`, { method: "DELETE" });
      const next = await loadDevices();
      if (next.length === 0) {
        await resetIdentity();
        setStatus("모든 기기를 해제해서 계정을 초기화했어요.");
        return;
      }
      setStatus("기기 연결을 해제했어요.");
    } catch (e: any) {
      setStatus(e?.message ?? "해제 실패");
    } finally {
      setLoading(false);
    }
  }

  async function revokeAllDevices() {
    if (devices.length === 0) return;
    setLoading(true);
    setStatus(null);
    try {
      for (const d of devices) {
        await api(`/auth/devices/${d.id}`, { method: "DELETE" });
      }
      await resetIdentity();
      setStatus("모든 기기를 해제해서 계정을 초기화했어요.");
    } catch (e: any) {
      setStatus(e?.message ?? "초기화 실패");
    } finally {
      setLoading(false);
    }
  }

  async function resetLocalOnly() {
    const ok = confirm("브라우저에 저장된 모든 데이터가 삭제됩니다. 계속할까요?");
    if (!ok) return;
    setLoading(true);
    setStatus(null);
    try {
      await resetLocalState();
      setStatus("로컬 데이터가 초기화되었어요. 새로고침할게요.");
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  function formatShort(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  }

  async function retryRegister() {
    setInitializing(true);
    setStatus(null);
    try {
      const res = await ensureAuth();
      setUserId(res?.userId ?? getUserId());
      setDeviceId(res?.deviceId ?? getDeviceId());
      setPairingCode(res?.pairingCode ?? getPairingCode());
      if (!res) setStatus("페어링 코드 발급에 실패했어요. 서버 상태를 확인해 주세요.");
    } finally {
      setInitializing(false);
    }
  }

  const headerTitle = isRetro ? "맞춤" : "설정";
  const headerSubtitle = isRetro 
    ? "기기 잇기" 
    : "이메일 없이 페어링 코드로 여러 기기를 연결하기";

  return (
    <div className="space-y-4">
      <div>
        {isRetro ? (
          <div className="flex items-baseline justify-between border-b-4 border-black pb-2 mb-4">
            <div className="text-xl font-bold uppercase tracking-tighter">{headerTitle}</div>
          </div>
        ) : (
          <div className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {headerTitle}
          </div>
        )}
        <div className={cn(
          isRetro ? "text-xs font-bold text-neutral-500 uppercase" : "text-sm text-muted-foreground"
        )}>
          {headerSubtitle}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
        <div className="text-sm text-muted-foreground">내 페어링 코드</div>
        <div className="text-2xl font-semibold tracking-widest">
          {initializing ? "발급 중…" : (pairingCode ?? "—")}
        </div>
        <div className="text-xs text-muted-foreground">다른 기기에서 이 코드를 입력해 주세요.</div>
        {!pairingCode ? (
          <button
            type="button"
            onClick={retryRegister}
            disabled={initializing}
            className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-40"
          >
            다시 발급하기
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="text-sm font-semibold">다른 기기와 연결</div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="페어링 코드 입력"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={pair}
          disabled={loading || !input.trim()}
          className="w-full rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-40"
        >
          {loading ? "연결 중…" : "연결하기"}
        </button>
        {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-2">
        <div className="text-sm text-muted-foreground">내 계정 정보</div>
        <div className="text-xs text-muted-foreground">User: {userId ?? "—"}</div>
        <div className="text-xs text-muted-foreground">Device: {deviceId ?? "—"}</div>
      </section>

      <section className={cn(
        "rounded-2xl p-6 shadow-sm space-y-3",
        isRetro ? "border-4 border-black bg-white" : "border border-border bg-card"
      )}>
        <div className="text-sm font-semibold">로컬 데이터 초기화</div>
        <div className="text-xs text-muted-foreground">
          이 기기에 저장된 기록/캐시를 모두 삭제해요. 서버 데이터는 삭제되지 않아요.
        </div>
        <button
          type="button"
          onClick={resetLocalOnly}
          disabled={loading}
          className={cn(
            "w-full px-4 py-3 text-sm font-semibold",
            isRetro
              ? "border-2 border-black bg-white text-black hover:bg-yellow-200"
              : "rounded-2xl border border-border bg-card text-muted-foreground hover:bg-muted",
            loading && "opacity-40"
          )}
        >
          로컬 초기화
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
        <div className="text-sm font-semibold">연결된 기기</div>
        {devices.length === 0 ? (
          <div className="text-sm text-muted-foreground">연결된 기기가 없어요.</div>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => {
              const isCurrent = d.id === deviceId;
              return (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-border bg-card/80 px-3 py-2 text-card-foreground">
                  <div>
                    <div className="text-sm text-foreground">
                      {isCurrent ? "현재 기기" : "연결된 기기"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.browser ?? "브라우저"} · {d.os ?? "OS"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      생성 {formatShort(d.createdAt)} · 최근 {formatShort(d.lastSeenAt)}
                    </div>
                  </div>
                  {!isCurrent ? (
                    <button
                      type="button"
                      onClick={() => revokeDevice(d.id)}
                      disabled={loading}
                      className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      연결 해제
                    </button>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100">현재</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {devices.length > 0 ? (
          <button
            type="button"
            onClick={revokeAllDevices}
            disabled={loading}
            className="mt-2 w-full rounded-2xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-40"
          >
            모든 기기 해제하고 초기화
          </button>
        ) : null}
      </section>
    </div>
  );
}
