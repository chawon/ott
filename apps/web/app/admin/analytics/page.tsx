import { getTranslations } from "next-intl/server";

type Props = {
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

function readParam(value: string | string[] | undefined): string | null {
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

type AcquisitionCounts = {
  sessions: number;
  engagedSessions: number;
  firstLogSessions: number;
  logCreateSessions: number;
};

type AcquisitionDimension = AcquisitionCounts & {
  key: string;
};

type AdminAcquisition = {
  days: number;
  from: string;
  to: string;
  summary: AcquisitionCounts;
  byChannel: AcquisitionDimension[];
  bySource: AcquisitionDimension[];
  byLandingPath: AcquisitionDimension[];
  byLocale: AcquisitionDimension[];
  byCampaign: AcquisitionDimension[];
  daily: Array<AcquisitionCounts & { day: string }>;
  orphanConversionSessions: number;
};

export default async function AdminAnalyticsPage({ searchParams }: Props) {
  const locale = "ko";
  const t = await getTranslations({ locale, namespace: "Admin" });
  const sParams = searchParams ? await searchParams : {};
  const adminToken = process.env.ADMIN_ANALYTICS_TOKEN?.trim() || null;
  const backendUrl = process.env.BACKEND_URL ?? null;
  const daysRaw = readParam(sParams?.days);
  const parsedDays = daysRaw ? Number(daysRaw) : 30;
  const days = [7, 30, 90, 180].includes(parsedDays) ? parsedDays : 30;

  if (!backendUrl || !adminToken) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-red-500">{t("envError")}</p>
      </div>
    );
  }

  let overview: AdminOverview | null = null;
  let acquisition: AdminAcquisition | null = null;
  let recentEvents: AdminEventRow[] = [];
  let loadError: string | null = null;
  let acquisitionLoadError: string | null = null;
  try {
    const safeDays = days;
    const adminHeaders = { "X-Admin-Token": adminToken };
    const [response, eventsResponse, acquisitionResponse] = await Promise.all([
      fetch(
        `${backendUrl}/internal/admin/analytics/overview?days=${safeDays}`,
        {
          headers: adminHeaders,
          cache: "no-store",
        },
      ),
      fetch(
        `${backendUrl}/internal/admin/analytics/events?days=${safeDays}&limit=300`,
        {
          headers: adminHeaders,
          cache: "no-store",
        },
      ),
      fetch(
        `${backendUrl}/internal/admin/analytics/acquisition?days=${safeDays}`,
        {
          headers: adminHeaders,
          cache: "no-store",
        },
      ),
    ]);
    if (!response.ok || !eventsResponse.ok) {
      loadError = t("apiError", {
        status: response.ok ? eventsResponse.status : response.status,
      });
    } else {
      overview = (await response.json()) as AdminOverview;
      recentEvents = (await eventsResponse.json()) as AdminEventRow[];
    }
    if (acquisitionResponse.ok) {
      acquisition = (await acquisitionResponse.json()) as AdminAcquisition;
    } else {
      acquisitionLoadError = t("apiError", {
        status: acquisitionResponse.status,
      });
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
  const acquisitionCards = acquisition
    ? [
        {
          key: "sessions",
          label: t("acquisitionSessions"),
          value: acquisition.summary.sessions,
        },
        {
          key: "engagedSessions",
          label: t("acquisitionEngagedSessions"),
          value: acquisition.summary.engagedSessions,
        },
        {
          key: "firstLogSessions",
          label: t("acquisitionFirstLogSessions"),
          value: acquisition.summary.firstLogSessions,
        },
        {
          key: "logCreateSessions",
          label: t("acquisitionLogCreateSessions"),
          value: acquisition.summary.logCreateSessions,
        },
      ]
    : [];
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
            days: overview?.days ?? days,
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

          {acquisition ? (
            <section className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold">
                  {t("acquisitionTitle")}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("acquisitionDesc")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("queryPeriod", { days: acquisition.days })}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {acquisitionCards.map((metric) => (
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
              <p className="text-xs text-muted-foreground">
                {t("acquisitionOrphanSessions", {
                  count: numberFormatter.format(
                    acquisition.orphanConversionSessions,
                  ),
                })}
              </p>
              <AcquisitionDimensionTable
                title={t("acquisitionByChannel")}
                rows={acquisition.byChannel}
                numberFormatter={numberFormatter}
                labels={{
                  key: t("acquisitionDimension"),
                  sessions: t("acquisitionSessions"),
                  engaged: t("acquisitionEngagedSessions"),
                  firstLog: t("acquisitionFirstLogSessions"),
                  logCreate: t("acquisitionLogCreateSessions"),
                  empty: t("acquisitionEmpty"),
                }}
              />
              <AcquisitionDimensionTable
                title={t("acquisitionByLandingPath")}
                rows={acquisition.byLandingPath}
                numberFormatter={numberFormatter}
                labels={{
                  key: t("acquisitionDimension"),
                  sessions: t("acquisitionSessions"),
                  engaged: t("acquisitionEngagedSessions"),
                  firstLog: t("acquisitionFirstLogSessions"),
                  logCreate: t("acquisitionLogCreateSessions"),
                  empty: t("acquisitionEmpty"),
                }}
              />
              <AcquisitionDimensionTable
                title={t("acquisitionByCampaign")}
                rows={acquisition.byCampaign}
                numberFormatter={numberFormatter}
                labels={{
                  key: t("acquisitionDimension"),
                  sessions: t("acquisitionSessions"),
                  engaged: t("acquisitionEngagedSessions"),
                  firstLog: t("acquisitionFirstLogSessions"),
                  logCreate: t("acquisitionLogCreateSessions"),
                  empty: t("acquisitionEmpty"),
                }}
              />
            </section>
          ) : acquisitionLoadError ? (
            <section className="rounded-lg border border-border bg-card p-6 text-sm text-red-500">
              {t("acquisitionLoadError", { error: acquisitionLoadError })}
            </section>
          ) : null}

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

function AcquisitionDimensionTable({
  title,
  rows,
  numberFormatter,
  labels,
}: {
  title: string;
  rows: AcquisitionDimension[];
  numberFormatter: Intl.NumberFormat;
  labels: {
    key: string;
    sessions: string;
    engaged: string;
    firstLog: string;
    logCreate: string;
    empty: string;
  };
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">{labels.key}</th>
                <th className="py-2 pr-3">{labels.sessions}</th>
                <th className="py-2 pr-3">{labels.engaged}</th>
                <th className="py-2 pr-3">{labels.firstLog}</th>
                <th className="py-2 pr-3">{labels.logCreate}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-border/60">
                  <td className="max-w-[320px] break-all py-2 pr-3 font-medium">
                    {row.key || "-"}
                  </td>
                  <td className="py-2 pr-3">
                    {numberFormatter.format(row.sessions)}
                  </td>
                  <td className="py-2 pr-3">
                    {numberFormatter.format(row.engagedSessions)}
                  </td>
                  <td className="py-2 pr-3">
                    {numberFormatter.format(row.firstLogSessions)}
                  </td>
                  <td className="py-2 pr-3">
                    {numberFormatter.format(row.logCreateSessions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{labels.empty}</p>
      )}
    </section>
  );
}
