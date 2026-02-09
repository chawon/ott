import { notFound } from "next/navigation";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readToken(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return null;
}

type AdminOverview = {
  days: number;
  from: string;
  to: string;
  events: number;
  dau: number;
  wau: number;
  mau: number;
  funnelAppOpenUsers: number;
  funnelLoginUsers: number;
  funnelLogCreateUsers: number;
  platforms: Array<{ platform: "web" | "pwa" | "twa"; events: number; activeUsers: number }>;
};

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const token = readToken(params?.token);
  const expected = process.env.ADMIN_ANALYTICS_TOKEN ?? null;
  const backendUrl = process.env.BACKEND_URL ?? null;
  const daysRaw = readToken(params?.days);
  const days = daysRaw ? Number(daysRaw) : 30;

  // MVP: dedicated URL + server-side token check.
  if (!expected || token !== expected) {
    notFound();
  }

  if (!backendUrl) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">관리자 통계</h1>
        <p className="text-sm text-red-500">`BACKEND_URL` 환경변수가 설정되지 않아 통계를 불러올 수 없습니다.</p>
      </div>
    );
  }

  let overview: AdminOverview | null = null;
  let loadError: string | null = null;
  try {
    const response = await fetch(`${backendUrl}/api/admin/analytics/overview?days=${Number.isFinite(days) ? days : 30}`, {
      headers: {
        "X-Admin-Token": expected,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      loadError = `통계 API 오류: ${response.status}`;
    } else {
      overview = (await response.json()) as AdminOverview;
    }
  } catch (e: any) {
    loadError = e?.message ?? "통계 API 호출에 실패했습니다.";
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">관리자 통계</h1>
        <p className="text-sm text-muted-foreground">조회 기간: 최근 {overview?.days ?? (Number.isFinite(days) ? days : 30)}일</p>
      </section>

      {loadError ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-sm text-red-500">{loadError}</section>
      ) : overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">총 이벤트</div>
              <div className="mt-1 text-2xl font-semibold">{overview.events}</div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">DAU</div>
              <div className="mt-1 text-2xl font-semibold">{overview.dau}</div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">WAU</div>
              <div className="mt-1 text-2xl font-semibold">{overview.wau}</div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">MAU</div>
              <div className="mt-1 text-2xl font-semibold">{overview.mau}</div>
            </article>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">퍼널 (최근 {overview.days}일)</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">앱 오픈</div>
                <div className="text-xl font-semibold">{overview.funnelAppOpenUsers}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">로그인 성공</div>
                <div className="text-xl font-semibold">{overview.funnelLoginUsers}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">첫 기록/기록 생성</div>
                <div className="text-xl font-semibold">{overview.funnelLogCreateUsers}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">플랫폼별</div>
            <div className="mt-3 space-y-2">
              {overview.platforms.map((p) => (
                <div key={p.platform} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                  <span className="font-medium">{p.platform}</span>
                  <span className="text-muted-foreground">events {p.events} · active {p.activeUsers}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
