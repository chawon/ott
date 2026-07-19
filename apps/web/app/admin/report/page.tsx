import { getTranslations } from "next-intl/server";

type PodStatus = {
  name: string;
  phase: string;
  imageTag: string | null;
  cpuUsage: string | null;
  memoryUsage: string | null;
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
    titleSearchUsers: number;
    titleSelectUsers: number;
    loginUsers: number;
    firstLogCreateUsers: number;
    logCreateUsers: number;
    dbLogCreateCount: number;
    activity?: ActivityMetrics;
    reach?: ReachMetrics;
  };
  kubernetes: {
    pods: PodStatus[];
    error: string | null;
  };
};

export default async function AdminReportPage() {
  const locale = "ko";
  const t = await getTranslations({ locale, namespace: "Admin" });
  const numberLocale = locale === "ko" ? "ko-KR" : "en-US";
  const adminToken = process.env.ADMIN_ANALYTICS_TOKEN?.trim() || null;
  const backendUrl = process.env.BACKEND_URL ?? null;

  if (!backendUrl || !adminToken) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("dailyReportTitle")}
        </h1>
        <p className="text-sm text-red-500">{t("envError")}</p>
      </div>
    );
  }

  let report: DailyReport | null = null;
  let loadError: string | null = null;

  try {
    const res = await fetch(`${backendUrl}/internal/admin/report/daily`, {
      headers: { "X-Admin-Token": adminToken },
      cache: "no-store",
    });
    if (!res.ok) {
      loadError = t("apiError", { status: res.status });
    } else {
      report = await res.json();
    }
  } catch (e: unknown) {
    loadError = e instanceof Error ? e.message : t("callError");
  }

  const internalActivity = report?.internal.activity ?? null;
  const internalReach = report?.internal.reach ?? null;

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("dailyReportTitle")}
        </h1>
        {report && (
          <p className="text-sm text-muted-foreground">
            {t("dailyReportDate", { date: report.date })}
          </p>
        )}
      </section>

      {loadError && (
        <section className="rounded-lg border border-border bg-card p-6 text-sm text-red-500">
          {loadError}
        </section>
      )}

      {report && (
        <>
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">
              {t("cloudflareTraffic")}
            </div>
            {report.cloudflare.error ? (
              <p className="text-sm text-red-500">{report.cloudflare.error}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label={t("requests")}
                  value={report.cloudflare.requests.toLocaleString(
                    numberLocale,
                  )}
                />
                <Stat
                  label={t("visitors")}
                  value={report.cloudflare.uniqueVisitors.toLocaleString(
                    numberLocale,
                  )}
                />
                <Stat
                  label={t("pageViews")}
                  value={report.cloudflare.pageViews.toLocaleString(
                    numberLocale,
                  )}
                />
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold">{t("ga4Users")}</div>
            {report.ga4.error ? (
              <p className="text-sm text-red-500">{report.ga4.error}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label={t("sessions")}
                  value={report.ga4.sessions.toLocaleString(numberLocale)}
                />
                <Stat
                  label={t("ga4ActiveUsers")}
                  value={report.ga4.activeUsers.toLocaleString(numberLocale)}
                />
                <Stat
                  label={t("pageViews")}
                  value={report.ga4.pageViews.toLocaleString(numberLocale)}
                />
                <Stat
                  label={t("newUsers")}
                  value={report.ga4.newUsers.toLocaleString(numberLocale)}
                />
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-1">
              <div className="text-sm font-semibold">
                {t("internalActivity")}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("dailyInternalDesc")}
              </p>
            </div>
            {internalActivity && internalReach ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Stat
                    label={t("qualifiedActors")}
                    value={internalActivity.qualifiedActors.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("activeClients")}
                    value={internalActivity.activeClients.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("appOpenSessions")}
                    value={internalActivity.appOpenSessions.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("rawAppOpenEvents")}
                    value={internalActivity.rawAppOpenEvents.toLocaleString(
                      numberLocale,
                    )}
                  />
                </div>
                <div className="space-y-1 border-t border-border pt-4">
                  <div className="text-sm font-semibold">
                    {t("periodReachTitle")}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("dailyReachDesc")}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Stat
                    label={t("reachTitleSearch")}
                    value={internalReach.titleSearchActors.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("reachTitleSelect")}
                    value={internalReach.titleSelectActors.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("reachConnected")}
                    value={internalReach.loginActors.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("reachFirstLog")}
                    value={internalReach.firstLogCreateActors.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("reachLogCreators")}
                    value={internalReach.logCreateActors.toLocaleString(
                      numberLocale,
                    )}
                  />
                  <Stat
                    label={t("dbLogCreateCount")}
                    value={report.internal.dbLogCreateCount.toLocaleString(
                      numberLocale,
                    )}
                  />
                </div>
              </>
            ) : (
              <p className="rounded-lg border border-border bg-secondary p-4 text-sm text-muted-foreground">
                {t("metricsSchemaUnavailable")}
              </p>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                {t("kubernetesInfrastructure")}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("realtime")}
                </span>
              </div>
              <a
                href="https://clarity.microsoft.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand-navy underline-offset-4 hover:underline dark:text-muted-foreground"
              >
                {t("clarityLink")}
              </a>
            </div>
            {report.kubernetes.error ? (
              <p className="text-sm text-red-500">{report.kubernetes.error}</p>
            ) : report.kubernetes.pods.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noPods")}</p>
            ) : (
              <div className="space-y-2">
                {report.kubernetes.pods.map((pod) => (
                  <div
                    key={pod.name}
                    className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {pod.phase}
                      </span>
                      <span className="font-medium">{pod.name}</span>
                      {pod.imageTag && (
                        <span className="text-xs text-muted-foreground font-mono">
                          [{pod.imageTag}]
                        </span>
                      )}
                    </div>
                    {(pod.cpuUsage || pod.memoryUsage) && (
                      <span className="text-xs text-muted-foreground">
                        {t("podResources", {
                          cpu: pod.cpuUsage ?? "-",
                          memory: pod.memoryUsage ?? "-",
                        })}
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
    <article className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </article>
  );
}
