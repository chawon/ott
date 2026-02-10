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
  eventBreakdown: Array<{ eventName: string; events: number; actors: number }>;
  daily: Array<{
    day: string;
    events: number;
    appOpenUsers: number;
    loginUsers: number;
    logCreateUsers: number;
    shareActionUsers: number;
  }>;
};

type AdminEventRow = {
  eventId: string;
  userId: string | null;
  sessionId: string;
  eventName: string;
  platform: "web" | "pwa" | "twa";
  clientVersion: string | null;
  properties: string;
  occurredAt: string;
  createdAt: string;
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
  let recentEvents: AdminEventRow[] = [];
  let loadError: string | null = null;
  try {
    const safeDays = Number.isFinite(days) ? days : 30;
    const response = await fetch(`${backendUrl}/api/admin/analytics/overview?days=${safeDays}`, {
      headers: {
        "X-Admin-Token": expected,
      },
      cache: "no-store",
    });
    const eventsResponse = await fetch(`${backendUrl}/api/admin/analytics/events?days=${safeDays}&limit=300`, {
      headers: {
        "X-Admin-Token": expected,
      },
      cache: "no-store",
    });
    if (!response.ok || !eventsResponse.ok) {
      loadError = `통계 API 오류: ${response.status}`;
    } else {
      overview = (await response.json()) as AdminOverview;
      recentEvents = (await eventsResponse.json()) as AdminEventRow[];
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

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">이벤트 종류별 상세</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">event</th>
                    <th className="py-2 pr-3">count</th>
                    <th className="py-2 pr-3">actors</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.eventBreakdown.map((item) => (
                    <tr key={item.eventName} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{item.eventName}</td>
                      <td className="py-2 pr-3">{item.events}</td>
                      <td className="py-2 pr-3">{item.actors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">일자별 상세</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">day</th>
                    <th className="py-2 pr-3">events</th>
                    <th className="py-2 pr-3">app_open</th>
                    <th className="py-2 pr-3">login_success</th>
                    <th className="py-2 pr-3">log_create</th>
                    <th className="py-2 pr-3">share_action</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.daily.map((d) => (
                    <tr key={d.day} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{d.day}</td>
                      <td className="py-2 pr-3">{d.events}</td>
                      <td className="py-2 pr-3">{d.appOpenUsers}</td>
                      <td className="py-2 pr-3">{d.loginUsers}</td>
                      <td className="py-2 pr-3">{d.logCreateUsers}</td>
                      <td className="py-2 pr-3">{d.shareActionUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">최근 수집 이벤트 (최대 300)</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                    <th className="py-2 pr-3">occurredAt</th>
                    <th className="py-2 pr-3">event</th>
                    <th className="py-2 pr-3">platform</th>
                    <th className="py-2 pr-3">userId</th>
                    <th className="py-2 pr-3">sessionId</th>
                    <th className="py-2 pr-3">clientVersion</th>
                    <th className="py-2 pr-3">properties</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((row) => (
                    <tr key={row.eventId} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(row.occurredAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
                      <td className="py-2 pr-3 font-medium">{row.eventName}</td>
                      <td className="py-2 pr-3">{row.platform}</td>
                      <td className="py-2 pr-3">{row.userId ?? "-"}</td>
                      <td className="py-2 pr-3">{row.sessionId}</td>
                      <td className="py-2 pr-3">{row.clientVersion ?? "-"}</td>
                      <td className="py-2 pr-3 max-w-[440px] break-all text-muted-foreground">{row.properties}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
