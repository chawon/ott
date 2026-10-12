"use client";

import { ArrowLeft, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Link as IntlLink } from "@/i18n/routing";
import {
  listAllLogsLocal,
  listNetflixViewingsLocal,
  saveNetflixImportLocal,
} from "@/lib/localStore";
import {
  type NetflixImportRow,
  parseNetflixHistoryCsv,
  prepareNetflixImportRows,
} from "@/lib/netflixImport";
import { syncOutbox } from "@/lib/sync";
import type { WatchLog } from "@/lib/types";

const MAX_FILE_BYTES = 2_000_000;

export default function NetflixImportPage() {
  const t = useTranslations("NetflixImport");
  const tCommon = useTranslations("Common");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<NetflixImportRow[]>([]);
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [manualLinks, setManualLinks] = useState<Record<string, string>>({});
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const videoLogs = useMemo(
    () =>
      logs
        .filter((log) => !log.deletedAt && log.title.type !== "book")
        .sort((a, b) => a.title.name.localeCompare(b.title.name)),
    [logs],
  );
  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; count: number; linkedTitleId: string | null }
    >();
    for (const row of rows) {
      const current = grouped.get(row.workTitle);
      if (current) {
        current.count++;
        if (current.linkedTitleId !== row.linkedTitleId)
          current.linkedTitleId = null;
      } else {
        grouped.set(row.workTitle, {
          title: row.workTitle,
          count: 1,
          linkedTitleId: row.linkedTitleId,
        });
      }
    }
    return [...grouped.values()].sort(
      (a, b) => b.count - a.count || a.title.localeCompare(b.title),
    );
  }, [rows]);
  const matchedCount = rows.filter((row) => {
    const override = manualLinks[row.workTitle];
    return override === undefined
      ? Boolean(row.linkedTitleId)
      : Boolean(override);
  }).length;
  const alreadyImported = rows.filter((row) =>
    existingKeys.has(row.sourceKey),
  ).length;

  async function handleFile(file: File | null) {
    setRows([]);
    setFileName(file?.name ?? "");
    setManualLinks({});
    setError(null);
    setFeedback(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }
    setReading(true);
    try {
      await syncOutbox().catch(() => {});
      const savedLogs = await listAllLogsLocal();
      const parsed = parseNetflixHistoryCsv(await file.text());
      const prepared = await prepareNetflixImportRows(parsed, savedLogs);
      const savedEvents = await listNetflixViewingsLocal();
      setLogs(savedLogs);
      setRows(prepared);
      setExistingKeys(new Set(savedEvents.map((event) => event.sourceKey)));
    } catch {
      setError(t("invalidFile"));
    } finally {
      setReading(false);
    }
  }

  async function handleImport() {
    if (saving || rows.length === 0) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const chosen = rows.map((row) => {
        const override = manualLinks[row.workTitle];
        return override === undefined
          ? row
          : { ...row, linkedTitleId: override || null };
      });
      const added = await saveNetflixImportLocal(chosen);
      window.dispatchEvent(new CustomEvent("sync:updated"));
      if (added === 0) {
        setFeedback(t("alreadySaved"));
        return;
      }
      await syncOutbox().catch(() => {});
      const saved = await listNetflixViewingsLocal();
      const newKeys = new Set(chosen.map((row) => row.sourceKey));
      const pending = saved.filter(
        (event) =>
          newKeys.has(event.sourceKey) && event.syncStatus !== "synced",
      ).length;
      setExistingKeys(new Set(saved.map((event) => event.sourceKey)));
      setFeedback(
        pending > 0
          ? t("savedPending", { count: added })
          : t("saved", { count: added }),
      );
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 pb-12">
      <IntlLink
        href="/account"
        className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[#1E4D8C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60 dark:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("back")}
      </IntlLink>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="text-base text-muted-foreground">{t("description")}</p>
      </header>

      <section className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <FileUp
            className="mt-1 h-5 w-5 shrink-0 text-[#1E4D8C] dark:text-foreground"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("chooseFile")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("fileHelp")}</p>
          </div>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label={t("chooseFile")}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          className="block min-h-12 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-ott-paper-strong file:px-3 file:py-1.5 file:font-semibold file:text-[#1E4D8C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60 dark:file:text-foreground"
        />
        {fileName ? (
          <p className="text-sm text-muted-foreground">{fileName}</p>
        ) : null}
        {reading ? (
          <p className="text-sm text-muted-foreground">{t("reading")}</p>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t("previewTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("previewDesc")}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t("rowCount"), rows.length],
              [t("matchedCount"), matchedCount],
              [t("unmatchedCount"), rows.length - matchedCount],
              [t("alreadyCount"), alreadyImported],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-ott-paper-strong p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <details className="rounded-lg border border-border p-3">
            <summary className="min-h-10 cursor-pointer text-sm font-semibold text-[#1E4D8C] dark:text-foreground">
              {t("reviewWorks", { count: groups.length })}
            </summary>
            <div className="max-h-80 space-y-3 overflow-y-auto pt-3">
              {groups.map((group) => {
                const selected =
                  manualLinks[group.title] ?? group.linkedTitleId ?? "";
                return (
                  <div
                    key={group.title}
                    className="space-y-2 rounded-lg bg-ott-paper p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="break-words text-sm font-semibold text-foreground">
                        {group.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t("episodes", { count: group.count })}
                      </span>
                    </div>
                    <label className="block space-y-1 text-xs text-muted-foreground">
                      <span>{t("connectToExisting")}</span>
                      <select
                        value={selected}
                        onChange={(event) =>
                          setManualLinks((current) => ({
                            ...current,
                            [group.title]: event.target.value,
                          }))
                        }
                        className="min-h-12 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60"
                      >
                        <option value="">{t("keepSeparate")}</option>
                        {videoLogs.map((log) => (
                          <option key={log.title.id} value={log.title.id}>
                            {log.title.name}
                            {log.title.year ? ` (${log.title.year})` : ""} ·{" "}
                            {log.title.type === "series"
                              ? tCommon("typeSeries")
                              : tCommon("typeMovie")}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          </details>

          <p className="text-sm text-muted-foreground">
            {t("protectExisting")}
          </p>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={saving}
            className="min-h-12 w-full rounded-lg bg-[#FF9933] px-6 text-base font-semibold text-[#0F0F0F] transition-colors hover:bg-[#E9B83F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9933]/60 disabled:bg-[#ECEBE9] disabled:text-[#4A4A4A]"
          >
            {saving ? t("saving") : t("importAction")}
          </button>
        </section>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-[#FEF9EE] p-3 text-sm text-foreground"
        >
          {error}
        </p>
      ) : null}
      {feedback ? (
        <div className="space-y-2 rounded-lg bg-[#FEF9EE] p-4 text-sm text-foreground">
          <output className="block">{feedback}</output>
          <IntlLink
            href="/timeline/netflix"
            className="inline-flex min-h-10 items-center font-semibold text-[#1E4D8C] hover:underline dark:text-foreground"
          >
            {t("viewHistory")}
          </IntlLink>
        </div>
      ) : null}
    </main>
  );
}
