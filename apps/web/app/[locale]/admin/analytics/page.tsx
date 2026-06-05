import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
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
  funnelTitleSearchUsers: number;
  funnelTitleSelectUsers: number;
  funnelLoginUsers: number;
  funnelFirstLogCreateUsers: number;
  funnelLogCreateUsers: number;
  platforms: Array<{
    platform: "web" | "pwa" | "twa";
    events: number;
    activeUsers: number;
  }>;
  deviceTypes: Array<{ key: string; events: number; activeUsers: number }>;
  osFamilies: Array<{ key: string; events: number; activeUsers: number }>;
  browserFamilies: Array<{ key: string; events: number; activeUsers: number }>;
  installStates: Array<{ key: string; events: number; activeUsers: number }>;
  domains: Array<{ key: string; events: number; activeUsers: number }>;
  eventBreakdown: Array<{ eventName: string; events: number; actors: number }>;
  daily: Array<{
    day: string;
    events: number;
    appOpenUsers: number;
    titleSearchUsers: number;
    titleSelectUsers: number;
    loginUsers: number;
    firstLogCreateUsers: number;
    logCreateUsers: number;
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

export default async function AdminAnalyticsPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });
  const sParams = searchParams ? await searchParams : {};
  const token = readToken(sParams?.token);
  const expected = process.env.ADMIN_ANALYTICS_TOKEN?.trim() || null;
  const backendUrl = process.env.BACKEND_URL ?? null;
  const daysRaw = readToken(sParams?.days);
  const days = daysRaw ? Number(daysRaw) : 30;
  const adminToken = token;

  // Require an explicit token in the URL. If the frontend also knows the
  // expected token, fail closed here; otherwise let the backend verify it.
  if (!adminToken || (expected && adminToken !== expected)) {
    notFound();
  }

  if (!backendUrl) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-red-500">{t("envError")}</p>
      </div>
    );
  }

  let overview: AdminOverview | null = null;
  let recentEvents: AdminEventRow[] = [];
  let loadError: string | null = null;
  try {
    const safeDays = Number.isFinite(days) ? days : 30;
    const response = await fetch(
      `${backendUrl}/api/admin/analytics/overview?days=${safeDays}`,
      {
        headers: {
          "X-Admin-Token": adminToken,
        },
        cache: "no-store",
      },
    );
    const eventsResponse = await fetch(
      `${backendUrl}/api/admin/analytics/events?days=${safeDays}&limit=300`,
      {
        headers: {
          "X-Admin-Token": adminToken,
        },
        cache: "no-store",
      },
    );
    if (!response.ok || !eventsResponse.ok) {
      loadError = t("apiError", {
        status: response.ok ? eventsResponse.status : response.status,
      });
    } else {
      overview = (await response.json()) as AdminOverview;
      recentEvents = (await eventsResponse.json()) as AdminEventRow[];
    }
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : t("callError");
  }

  const hiddenEventNames = new Set([
    "share_action",
    "migration_complete",
    "retro_mode_toggle",
    "recommendation_open",
    "recommendation_refresh",
    "recommendation_dismiss",
  ]);
  const isHiddenEvent = (eventName: string) =>
    eventName.startsWith("onboarding_first_log_") ||
    hiddenEventNames.has(eventName);
  const visibleEventBreakdown = overview
    ? overview.eventBreakdown.filter((item) => !isHiddenEvent(item.eventName))
    : [];
  const visibleRecentEvents = recentEvents.filter(
    (row) => !isHiddenEvent(row.eventName),
  );
  const numberFormatter = new Intl.NumberFormat(
    locale === "ko" ? "ko-KR" : "en-US",
  );
  const percentFormatter = new Intl.NumberFormat(
    locale === "ko" ? "ko-KR" : "en-US",
    {
      maximumFractionDigits: 1,
      style: "percent",
    },
  );
  const formatRate = (numerator: number, denominator: number) =>
    denominator > 0 ? percentFormatter.format(numerator / denominator) : "-";
  const funnelSteps = overview
    ? [
        {
          eventName: "app_open",
          label: t("funnelVisitors"),
          previous: null,
          value: overview.funnelAppOpenUsers,
        },
        {
          eventName: "title_search",
          label: t("funnelTitleSearch"),
          previous: overview.funnelAppOpenUsers,
          value: overview.funnelTitleSearchUsers,
        },
        {
          eventName: "title_select",
          label: t("funnelTitleSelect"),
          previous: overview.funnelTitleSearchUsers,
          value: overview.funnelTitleSelectUsers,
        },
        {
          eventName: "login_success",
          label: t("funnelConnected"),
          previous: overview.funnelTitleSelectUsers,
          value: overview.funnelLoginUsers,
        },
        {
          eventName: "first_log_create",
          label: t("funnelFirstLog"),
          previous: overview.funnelLoginUsers,
          value: overview.funnelFirstLogCreateUsers,
        },
        {
          eventName: "log_create",
          label: t("funnelLogCreators"),
          previous: overview.funnelFirstLogCreateUsers,
          value: overview.funnelLogCreateUsers,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("queryPeriod", {
            days: overview?.days ?? (Number.isFinite(days) ? days : 30),
          })}
        </p>
      </section>

      {loadError ? (
        <section className="rounded-2xl border border-border bg-card p-6 text-sm text-red-500">
          {loadError}
        </section>
      ) : overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">
                {t("totalEvents")}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {overview.events}
              </div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("dau")}</div>
              <div className="mt-1 text-2xl font-semibold">{overview.dau}</div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("wau")}</div>
              <div className="mt-1 text-2xl font-semibold">{overview.wau}</div>
            </article>
            <article className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t("mau")}</div>
              <div className="mt-1 text-2xl font-semibold">{overview.mau}</div>
            </article>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  {t("productFunnelTitle")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("productFunnelDesc")}
                </p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3 md:min-w-[180px]">
                <div className="text-xs text-muted-foreground">
                  {t("visitToLogRate")}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {formatRate(
                    overview.funnelLogCreateUsers,
                    overview.funnelAppOpenUsers,
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {funnelSteps.map((step) => (
                <article
                  key={step.eventName}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {step.label}
                  </div>
                  <div className="mt-1 text-2xl font-semibold">
                    {numberFormatter.format(step.value)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {step.eventName}
                  </div>
                  {step.previous !== null ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>{t("conversionFromPrevious")}</span>
                        <span className="font-medium text-foreground">
                          {formatRate(step.value, step.previous)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>{t("conversionFromVisit")}</span>
                        <span className="font-medium text-foreground">
                          {formatRate(step.value, overview.funnelAppOpenUsers)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      {t("activeUsersLabel")}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("byPlatform")}</div>
            <div className="mt-3 space-y-2">
              {overview.platforms.map((p) => (
                <div
                  key={p.platform}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{p.platform}</span>
                  <span className="text-muted-foreground">
                    events {p.events} · active {p.activeUsers}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("deviceSegments")}</div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  device_type
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.deviceTypes.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        events {row.events} · active {row.activeUsers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  os_family
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.osFamilies.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        events {row.events} · active {row.activeUsers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  browser_family
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.browserFamilies.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        events {row.events} · active {row.activeUsers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  install_state
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.installStates.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        events {row.events} · active {row.activeUsers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  domain (hostname)
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.domains.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        events {row.events} · active {row.activeUsers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("eventDetails")}</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">{t("event")}</th>
                    <th className="py-2 pr-3">{t("count")}</th>
                    <th className="py-2 pr-3">{t("actors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEventBreakdown.map((item) => (
                    <tr
                      key={item.eventName}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 pr-3 font-medium">
                        {item.eventName}
                      </td>
                      <td className="py-2 pr-3">{item.events}</td>
                      <td className="py-2 pr-3">{item.actors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("dailyDetails")}</div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3">day</th>
                    <th className="py-2 pr-3">events</th>
                    <th className="py-2 pr-3">app_open</th>
                    <th className="py-2 pr-3">title_search</th>
                    <th className="py-2 pr-3">title_select</th>
                    <th className="py-2 pr-3">login_success</th>
                    <th className="py-2 pr-3">first_log_create</th>
                    <th className="py-2 pr-3">log_create</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.daily.map((d) => (
                    <tr key={d.day} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{d.day}</td>
                      <td className="py-2 pr-3">{d.events}</td>
                      <td className="py-2 pr-3">{d.appOpenUsers}</td>
                      <td className="py-2 pr-3">{d.titleSearchUsers}</td>
                      <td className="py-2 pr-3">{d.titleSelectUsers}</td>
                      <td className="py-2 pr-3">{d.loginUsers}</td>
                      <td className="py-2 pr-3">{d.firstLogCreateUsers}</td>
                      <td className="py-2 pr-3">{d.logCreateUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <details className="rounded-2xl border border-border bg-card p-6">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              {t("recentEvents")}
            </summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                    <th className="py-2 pr-3">occurredAt</th>
                    <th className="py-2 pr-3">{t("event")}</th>
                    <th className="py-2 pr-3">platform</th>
                    <th className="py-2 pr-3">userId</th>
                    <th className="py-2 pr-3">sessionId</th>
                    <th className="py-2 pr-3">clientVersion</th>
                    <th className="py-2 pr-3">properties</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecentEvents.map((row) => (
                    <tr
                      key={row.eventId}
                      className="border-b border-border/60 align-top"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(row.occurredAt).toLocaleString(
                          locale === "ko" ? "ko-KR" : "en-US",
                          {
                            timeZone: "Asia/Seoul",
                          },
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium">{row.eventName}</td>
                      <td className="py-2 pr-3">{row.platform}</td>
                      <td className="py-2 pr-3">{row.userId ?? "-"}</td>
                      <td className="py-2 pr-3">{row.sessionId}</td>
                      <td className="py-2 pr-3">{row.clientVersion ?? "-"}</td>
                      <td className="py-2 pr-3 max-w-[440px] break-all text-muted-foreground">
                        {row.properties}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
