import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ActivityMetrics = {
  rawAppOpenEvents: number;
  appOpenSessions: number;
  activeClients: number;
  qualifiedActors: number;
};

type ReachMetrics = {
  titleSearchActors: number;
  titleSelectActors: number;
  loginActors: number;
  firstLogCreateActors: number;
  logCreateActors: number;
};

type AppOpenDimensionSummary = {
  key: string;
  events: number;
  activeUsers: number;
  appOpenSessions?: number;
  activeClients?: number;
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
  activity?: {
    period: ActivityMetrics;
    today: ActivityMetrics;
    last7Days: ActivityMetrics;
    last30Days: ActivityMetrics;
  };
  reach?: ReachMetrics;
  platforms: Array<{
    platform: "web" | "pwa" | "twa" | "ios_native";
    events: number;
    activeUsers: number;
    rawAppOpenEvents?: number;
    appOpenSessions?: number;
    activeClients?: number;
    qualifiedActors?: number;
  }>;
  deviceTypes: AppOpenDimensionSummary[];
  osFamilies: AppOpenDimensionSummary[];
  browserFamilies: AppOpenDimensionSummary[];
  installStates: AppOpenDimensionSummary[];
  domains: AppOpenDimensionSummary[];
  iosAppVersions?: AppOpenDimensionSummary[];
  iosBuildNumbers?: AppOpenDimensionSummary[];
  androidAppVersions?: AppOpenDimensionSummary[];
  androidAppVersionCodes?: AppOpenDimensionSummary[];
  androidTwaSignals?: AppOpenDimensionSummary[];
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
    activity?: ActivityMetrics;
    reach?: ReachMetrics;
  }>;
};

type AdminEventRow = {
  eventId: string;
  userId: string | null;
  sessionId: string;
  eventName: string;
  platform: "web" | "pwa" | "twa" | "ios_native";
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
  const iosAppVersions = overview?.iosAppVersions ?? [];
  const iosBuildNumbers = overview?.iosBuildNumbers ?? [];
  const androidAppVersions = overview?.androidAppVersions ?? [];
  const androidAppVersionCodes = overview?.androidAppVersionCodes ?? [];
  const androidTwaSignals = overview?.androidTwaSignals ?? [];
  const numberFormatter = new Intl.NumberFormat(
    locale === "ko" ? "ko-KR" : "en-US",
  );
  const activity = overview?.activity ?? null;
  const reach = overview?.reach ?? null;
  const hasTrustworthyMetrics = activity !== null && reach !== null;
  const activityCards = activity
    ? [
        {
          key: "qualifiedActors",
          label: t("qualifiedActors"),
          value: activity.period.qualifiedActors,
        },
        {
          key: "activeClients",
          label: t("activeClients"),
          value: activity.period.activeClients,
        },
        {
          key: "appOpenSessions",
          label: t("appOpenSessions"),
          value: activity.period.appOpenSessions,
        },
        {
          key: "rawAppOpenEvents",
          label: t("rawAppOpenEvents"),
          value: activity.period.rawAppOpenEvents,
        },
      ]
    : [];
  const activityWindows = activity
    ? [
        { key: "today", label: t("windowToday"), value: activity.today },
        {
          key: "last7Days",
          label: t("windowLast7Days"),
          value: activity.last7Days,
        },
        {
          key: "last30Days",
          label: t("windowLast30Days"),
          value: activity.last30Days,
        },
      ]
    : [];
  const reachItems = reach
    ? [
        {
          eventName: "title_search",
          label: t("reachTitleSearch"),
          value: reach.titleSearchActors,
        },
        {
          eventName: "title_select",
          label: t("reachTitleSelect"),
          value: reach.titleSelectActors,
        },
        {
          eventName: "login_success",
          label: t("reachConnected"),
          value: reach.loginActors,
        },
        {
          eventName: "first_log_create",
          label: t("reachFirstLog"),
          value: reach.firstLogCreateActors,
        },
        {
          eventName: "log_create",
          label: t("reachLogCreators"),
          value: reach.logCreateActors,
        },
      ]
    : [];
  const hasDailyMetrics =
    overview?.daily.every((row) => row.activity && row.reach) ?? false;
  const formatOptional = (value: number | undefined) =>
    value === undefined ? "-" : numberFormatter.format(value);
  const formatDimensionKey = (key: string) =>
    key === "app_store_testflight" ? t("iosCombinedChannel") : key;

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
        <section className="rounded-lg border border-border bg-card p-6 text-sm text-red-500">
          {loadError}
        </section>
      ) : overview ? (
        <>
          <section className="rounded-lg border border-border bg-secondary p-4">
            <div className="text-sm font-semibold">
              {t("countingRulesTitle")}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("countingRulesDesc")}
            </p>
          </section>

          {hasTrustworthyMetrics && activity ? (
            <>
              <section className="space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">
                    {t("trustedActivityTitle")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t("trustedActivityDesc")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {activityCards.map((metric) => (
                    <article
                      key={metric.key}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <div className="text-xs text-muted-foreground">
                        {metric.label}
                      </div>
                      <div className="mt-1 text-2xl font-semibold">
                        {numberFormatter.format(metric.value)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-card p-6">
                <div className="text-sm font-semibold">
                  {t("periodActivityTitle")}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">{t("period")}</th>
                        <th className="py-2 pr-3">{t("qualifiedActors")}</th>
                        <th className="py-2 pr-3">{t("activeClients")}</th>
                        <th className="py-2 pr-3">{t("appOpenSessions")}</th>
                        <th className="py-2 pr-3">{t("rawAppOpenEvents")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activityWindows.map((window) => (
                        <tr
                          key={window.key}
                          className="border-b border-border/60"
                        >
                          <td className="py-3 pr-3 font-medium">
                            {window.label}
                          </td>
                          <td className="py-3 pr-3">
                            {numberFormatter.format(
                              window.value.qualifiedActors,
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            {numberFormatter.format(window.value.activeClients)}
                          </td>
                          <td className="py-3 pr-3">
                            {numberFormatter.format(
                              window.value.appOpenSessions,
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            {numberFormatter.format(
                              window.value.rawAppOpenEvents,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-card p-6">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">
                    {t("periodReachTitle")}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("periodReachDesc")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {reachItems.map((item) => (
                    <article
                      key={item.eventName}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1 text-2xl font-semibold">
                        {numberFormatter.format(item.value)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {item.eventName}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              {t("metricsSchemaUnavailable")}
            </section>
          )}

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("byPlatform")}</div>
            <div className="mt-3 space-y-2">
              {overview.platforms.map((p) => (
                <div
                  key={p.platform}
                  className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">{p.platform}</span>
                  <span className="text-muted-foreground">
                    {t("platformMetricSummary", {
                      raw: formatOptional(p.rawAppOpenEvents),
                      sessions: formatOptional(p.appOpenSessions),
                      clients: formatOptional(p.activeClients),
                      qualified: formatOptional(p.qualifiedActors),
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("deviceSegments")}</div>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  device_type
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.deviceTypes.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">
                        {formatDimensionKey(row.key)}
                      </span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
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
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
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
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  install_state
                </div>
                <div className="space-y-1.5 text-sm">
                  {overview.installStates.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">
                        {formatDimensionKey(row.key)}
                      </span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
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
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">
              {t("iosNativeSegments")}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("iosChannelNotice")}
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  ios_app_version
                </div>
                <div className="space-y-1.5 text-sm">
                  {iosAppVersions.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  ios_build_number
                </div>
                <div className="space-y-1.5 text-sm">
                  {iosBuildNumbers.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">
              {t("androidAppSegments")}
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  android_app_version
                </div>
                <div className="space-y-1.5 text-sm">
                  {androidAppVersions.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  android_app_version_code
                </div>
                <div className="space-y-1.5 text-sm">
                  {androidAppVersionCodes.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 text-xs font-semibold text-muted-foreground">
                  android_twa_signal
                </div>
                <div className="space-y-1.5 text-sm">
                  {androidTwaSignals.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between"
                    >
                      <span className="font-medium">{row.key}</span>
                      <span className="text-muted-foreground">
                        {t("dimensionMetricSummary", {
                          sessions: formatOptional(row.appOpenSessions),
                          clients: formatOptional(row.activeClients),
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
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
                      <td className="py-2 pr-3">
                        {numberFormatter.format(item.events)}
                      </td>
                      <td className="py-2 pr-3">
                        {numberFormatter.format(item.actors)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("dailyDetails")}</div>
            {hasDailyMetrics ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">{t("day")}</th>
                      <th className="py-2 pr-3">{t("qualifiedActors")}</th>
                      <th className="py-2 pr-3">{t("activeClients")}</th>
                      <th className="py-2 pr-3">{t("appOpenSessions")}</th>
                      <th className="py-2 pr-3">{t("rawAppOpenEvents")}</th>
                      <th className="py-2 pr-3">{t("reachTitleSearch")}</th>
                      <th className="py-2 pr-3">{t("reachTitleSelect")}</th>
                      <th className="py-2 pr-3">{t("reachConnected")}</th>
                      <th className="py-2 pr-3">{t("reachFirstLog")}</th>
                      <th className="py-2 pr-3">{t("reachLogCreators")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.daily.map((d) => {
                      if (!d.activity || !d.reach) return null;
                      return (
                        <tr key={d.day} className="border-b border-border/60">
                          <td className="py-2 pr-3 font-medium">{d.day}</td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.activity.qualifiedActors)}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.activity.activeClients)}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.activity.appOpenSessions)}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(
                              d.activity.rawAppOpenEvents,
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.reach.titleSearchActors)}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.reach.titleSelectActors)}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.reach.loginActors)}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(
                              d.reach.firstLogCreateActors,
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {numberFormatter.format(d.reach.logCreateActors)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("metricsSchemaUnavailable")}
              </p>
            )}
          </section>

          <details className="rounded-lg border border-border bg-card p-6">
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
