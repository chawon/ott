import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readToken(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return null;
}

type PodStatus = {
  name: string;
  phase: string;
  imageTag: string | null;
  cpuUsage: string | null;
  memoryUsage: string | null;
};

type DailyReport = {
  date: string;
  cloudflare: {
    requests: number;
    uniqueVisitors: number;
    pageViews: number;
    error: string | null;
  };
  ga4: {
    sessions: number;
    activeUsers: number;
    pageViews: number;
    newUsers: number;
    error: string | null;
  };
  internal: {
    dau: number;
    logCreate: number;
    newDevices: number;
  };
  kubernetes: {
    pods: PodStatus[];
    error: string | null;
  };
};


export default async function AdminReportPage({ params, searchParams }: Props) {
  await params;
  const sp = searchParams ? await searchParams : {};
  const token = readToken(sp?.token);
  const expected = process.env.ADMIN_ANALYTICS_TOKEN?.trim() || null;
  const backendUrl = process.env.BACKEND_URL ?? null;

  if (!token || (expected && token !== expected)) {
    notFound();
  }

  if (!backendUrl) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">데일리 운영 리포트</h1>
        <p className="text-sm text-red-500">BACKEND_URL 환경변수가 설정되지 않았습니다.</p>
      </div>
    );
  }

  let report: DailyReport | null = null;
  let loadError: string | null = null;

  try {
    const res = await fetch(`${backendUrl}/api/admin/report/daily`, {
      headers: { "X-Admin-Token": token },
      cache: "no-store",
    });
    if (!res.ok) {
      loadError = `API 오류: ${res.status}`;
    } else {
      report = await res.json();
    }
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : "알 수 없는 오류";
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">📊 데일리 운영 리포트</h1>
        {report && (
          <p className="text-sm text-muted-foreground">{report.date} 기준 (어제)</p>
        )}
      </section>

      {loadError && (
        <section className="rounded-2xl border border-border bg-card p-6 text-sm text-red-500">
          {loadError}
        </section>
      )}

      {report && (
        <>
          {/* Cloudflare */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="text-sm font-semibold">🌐 트래픽 (Cloudflare)</div>
            {report.cloudflare.error ? (
              <p className="text-sm text-red-500">⚠ {report.cloudflare.error}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="요청수" value={report.cloudflare.requests.toLocaleString("ko-KR")} />
                <Stat label="방문자" value={report.cloudflare.uniqueVisitors.toLocaleString("ko-KR")} />
                <Stat label="페이지뷰" value={report.cloudflare.pageViews.toLocaleString("ko-KR")} />
              </div>
            )}
          </section>

          {/* GA4 */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="text-sm font-semibold">📈 사용자 (Google Analytics 4)</div>
            {report.ga4.error ? (
              <p className="text-sm text-red-500">⚠ {report.ga4.error}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="세션" value={report.ga4.sessions.toLocaleString("ko-KR")} />
                <Stat label="활성 사용자" value={report.ga4.activeUsers.toLocaleString("ko-KR")} />
                <Stat label="페이지뷰" value={report.ga4.pageViews.toLocaleString("ko-KR")} />
                <Stat label="신규 사용자" value={report.ga4.newUsers.toLocaleString("ko-KR")} />
              </div>
            )}
          </section>

          {/* 내부 지표 */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="text-sm font-semibold">🎯 앱 활동 (내부)</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="DAU" value={report.internal.dau.toLocaleString("ko-KR")} />
              <Stat label="로그 생성" value={report.internal.logCreate.toLocaleString("ko-KR")} />
              <Stat label="신규 기기 등록" value={report.internal.newDevices.toLocaleString("ko-KR")} />
            </div>
          </section>

          {/* K8s */}
          <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">☸️ 인프라 (Kubernetes / ott)</div>
              <a
                href="https://clarity.microsoft.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:underline"
              >
                Microsoft Clarity →
              </a>
            </div>
            {report.kubernetes.error ? (
              <p className="text-sm text-red-500">⚠ {report.kubernetes.error}</p>
            ) : report.kubernetes.pods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pod 없음</p>
            ) : (
              <div className="space-y-2">
                {report.kubernetes.pods.map((pod) => (
                  <div
                    key={pod.name}
                    className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>{pod.phase === "Running" ? "✅" : "⚠️"}</span>
                      <span className="font-medium">{pod.name}</span>
                      {pod.imageTag && (
                        <span className="text-xs text-muted-foreground font-mono">[{pod.imageTag}]</span>
                      )}
                    </div>
                    {(pod.cpuUsage || pod.memoryUsage) && (
                      <span className="text-xs text-muted-foreground">
                        CPU {pod.cpuUsage ?? "-"} · Mem {pod.memoryUsage ?? "-"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </article>
  );
}
