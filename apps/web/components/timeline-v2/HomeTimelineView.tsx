"use client";

import {
  ArrowRight,
  BookOpen,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Share2,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Link } from "@/i18n/routing";
import { listAllLogsLocal, listOutbox } from "@/lib/localStore";
import { recordDisplayYear } from "@/lib/recordMetadata";
import {
  getSyncState,
  IDLE_SYNC_STATE,
  subscribeSyncState,
  syncOutbox,
} from "@/lib/sync";
import { collectTimelineMoments } from "@/lib/timelineMoments";
import type { WatchLog } from "@/lib/types";
import { formatNoteInline, statusLabel } from "@/lib/utils";
import {
  monthKey,
  monthLabel,
  RecordEdition,
  RecordFeeling,
  RecordMoment,
  RecordPoster,
  recordDate,
} from "./RecordParts";
import styles from "./timeline.module.css";

export default function HomeTimelineView({
  logs,
  loading,
  onRecord,
  onShare,
}: {
  logs: WatchLog[];
  loading: boolean;
  onRecord: () => void;
  onShare: (log: WatchLog) => void;
}) {
  const locale = useLocale();
  const ko = locale === "ko";
  const tStatus = useTranslations("Status");
  const tQuick = useTranslations("QuickLogCard");
  const tCommon = useTranslations("Common");
  const [today, setToday] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const featuredNote = useRef<HTMLQuoteElement>(null);
  const syncState = useSyncExternalStore(
    subscribeSyncState,
    getSyncState,
    () => IDLE_SYNC_STATE,
  );
  const syncing = retrying || syncState.status === "syncing";
  useEffect(() => {
    const refreshConnection = () => setOnline(navigator.onLine);
    refreshConnection();
    window.addEventListener("online", refreshConnection);
    window.addEventListener("offline", refreshConnection);
    return () => {
      window.removeEventListener("online", refreshConnection);
      window.removeEventListener("offline", refreshConnection);
    };
  }, []);
  useEffect(() => {
    const refreshDate = () =>
      setToday(
        new Intl.DateTimeFormat(ko ? "ko-KR" : "en-US", {
          month: ko ? "long" : "short",
          day: "numeric",
          weekday: ko ? "long" : "short",
        }).format(new Date()),
      );
    refreshDate();
    document.addEventListener("visibilitychange", refreshDate);
    const timer = window.setInterval(refreshDate, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", refreshDate);
      window.clearInterval(timer);
    };
  }, [ko]);
  const records = useMemo(
    () =>
      logs
        .filter((log) => !log.deletedAt && log.title?.id)
        .sort(
          (a, b) =>
            (recordDate(b)?.getTime() ?? 0) - (recordDate(a)?.getTime() ?? 0),
        ),
    [logs],
  );
  const months = useMemo(() => {
    const groups = new Map<string, WatchLog[]>();
    for (const record of records) {
      if (record.status !== "DONE") continue;
      const key = monthKey(recordDate(record));
      groups.set(key, [...(groups.get(key) ?? []), record]);
    }
    return [...groups].map(([key, items]) => ({ key, items }));
  }, [records]);
  useEffect(() => {
    if (selectedMonth && !months.some((month) => month.key === selectedMonth))
      setSelectedMonth(null);
  }, [months, selectedMonth]);
  const selected =
    months.find((month) => month.key === selectedMonth) ?? months[0];
  const featured = selected?.items[0];
  const featuredYear = featured
    ? recordDisplayYear(featured.title, featured)
    : null;
  const continuing = records
    .filter((log) => log.status === "IN_PROGRESS")
    .slice(0, 4);
  const pending = records.some(
    (log) => log.syncStatus === "pending" || log.syncStatus === "failed",
  );
  const noticeState =
    online === false
      ? "offline"
      : syncing
        ? "syncing"
        : syncError ||
            syncState.status === "failed" ||
            records.some((log) => log.syncStatus === "failed")
          ? "failed"
          : "pending";
  const featuredDate = featured ? recordDate(featured) : null;
  const moments = useMemo(() => collectTimelineMoments(records), [records]);
  const featuredNoteKey = featured?.note?.trim() ? featured.id : null;
  useEffect(() => {
    if (!featuredNoteKey) return;
    const note = featuredNote.current;
    if (!note || typeof ResizeObserver === "undefined") return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const updateLines = () => {
      if (!desktop.matches) {
        note.style.removeProperty("--featured-note-lines");
        return;
      }
      const lineHeight = Number.parseFloat(getComputedStyle(note).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return;
      // Round out the fractional pixel lost by clientHeight before clamping.
      const lines = Math.max(
        4,
        Math.floor((note.clientHeight + 1) / lineHeight),
      );
      note.style.setProperty("--featured-note-lines", String(lines));
    };
    const observer = new ResizeObserver(updateLines);
    observer.observe(note);
    desktop.addEventListener("change", updateLines);
    updateLines();
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", updateLines);
    };
  }, [featuredNoteKey]);

  async function retrySync() {
    if (syncing || online === false) return;
    setRetrying(true);
    setSyncError(false);
    try {
      await syncOutbox();
      // A handled push/auth failure can leave work queued without throwing.
      const [queued, localLogs] = await Promise.all([
        listOutbox(),
        listAllLogsLocal(),
      ]);
      setSyncError(
        queued.length > 0 ||
          localLogs.some(
            (log) =>
              !log.deletedAt &&
              (log.syncStatus === "pending" || log.syncStatus === "failed"),
          ),
      );
      window.dispatchEvent(new CustomEvent("sync:updated"));
    } catch {
      setSyncError(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className={styles.home}>
      <header className={styles.homeHeading}>
        <div>
          <p className={styles.eyebrow}>
            {ko ? "나의 타임라인" : "MY TIMELINE"}
          </p>
          <h1>
            {records.length
              ? ko
                ? "내 시간 위에 쌓인 이야기"
                : "Stories on your timeline"
              : ko
                ? "나의 타임라인에 첫 순간을 남겨요."
                : "Your timeline. Your first moment."}
          </h1>
        </div>
        <div className={styles.recordEntry}>
          <p className={styles.today} data-testid="home-current-date">
            {today || "\u00a0"}
          </p>
          {records.length > 0 ? (
            <button
              className={styles.recordButton}
              data-testid="home-record"
              type="button"
              onClick={onRecord}
            >
              <Plus size={19} aria-hidden="true" />
              <span className={styles.recordDesktopLabel}>
                {ko ? "오늘의 기록 남기기" : "Keep today’s story"}
              </span>
              <span className={styles.recordMobileLabel}>
                {ko ? "기록 남기기" : "Keep a story"}
              </span>
            </button>
          ) : null}
        </div>
      </header>
      {pending ? (
        <aside
          className={styles.syncNotice}
          role="status"
          data-testid="home-sync-notice"
          data-sync-state={noticeState}
        >
          <Clock3 size={19} aria-hidden="true" />
          <div>
            <strong>
              {ko
                ? "다른 기기에 아직 반영되지 않은 기록이 있어요."
                : "Some changes haven’t synced yet."}
            </strong>
            <p>
              {noticeState === "offline"
                ? ko
                  ? "기록은 이 기기에 보관했어요. 인터넷에 연결되면 다시 전할게요."
                  : "Your records are kept here. We’ll try syncing when you’re back online."
                : noticeState === "syncing"
                  ? ko
                    ? "다른 기기에서도 이어볼 수 있도록 기록을 전하고 있어요."
                    : "Syncing your records so you can pick them up on other devices."
                  : noticeState === "failed"
                    ? ko
                      ? "기록은 이 기기에 보관했지만 동기화를 마치지 못했어요. 잠시 뒤 다시 시도해 주세요."
                      : "Your records are kept here, but syncing didn’t finish. Please try again in a moment."
                    : ko
                      ? "기록은 이 기기에 보관했어요. 동기화가 끝나면 다른 기기에서도 이어볼 수 있어요."
                      : "Your records are kept here. They’ll appear on your other devices once synced."}
            </p>
          </div>
          <button
            type="button"
            data-testid="home-sync-retry"
            onClick={() => void retrySync()}
            disabled={syncing || online === false}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {syncing
              ? ko
                ? "동기화 중"
                : "Syncing"
              : ko
                ? "다시 시도"
                : "Retry"}
          </button>
        </aside>
      ) : null}
      {loading && records.length === 0 ? (
        <div
          className={styles.homeSkeleton}
          role="status"
          aria-label={ko ? "기록을 불러오는 중" : "Loading your records"}
        >
          <div />
          <div />
        </div>
      ) : records.length === 0 ? (
        <section className={styles.welcome}>
          <p>
            {ko
              ? "영화, 시리즈, 책. 남겨두고 싶은 작품 하나부터."
              : "A film, a series, a book. Start with one you want to keep."}
          </p>
          <div className={styles.welcomeActions}>
            <button
              className={styles.primaryButton}
              data-testid="home-first-record"
              type="button"
              onClick={onRecord}
            >
              <Plus size={19} aria-hidden="true" />
              {ko ? "첫 기록 남기기" : "Leave your first record"}
            </button>
            <Link href="/account" className={styles.quietLink}>
              {ko ? "이미 남긴 기록 이어보기" : "Bring my existing records"}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <div className={styles.homeLayout}>
          {months.length > 0 ? (
            <nav
              className={styles.months}
              aria-label={ko ? "기록한 달 펼치기" : "Explore your months"}
            >
              <p className={styles.eyebrow}>
                {ko ? "쌓아온 시간" : "YOUR MONTHS"}
              </p>
              {months.map((month) => (
                <button
                  key={month.key}
                  type="button"
                  aria-pressed={selected.key === month.key}
                  data-testid="home-month"
                  onClick={() => setSelectedMonth(month.key)}
                >
                  <span>
                    {month.key === "undated" ? "" : month.key.slice(0, 4)}
                  </span>
                  <strong>{monthLabel(month.key, locale, true)}</strong>
                </button>
              ))}
            </nav>
          ) : null}
          <div
            className={styles.homeMain}
            data-empty-months={months.length === 0}
          >
            {featured && selected ? (
              <>
                <article
                  className={styles.featured}
                  data-testid="home-featured"
                  data-log-id={featured.id}
                >
                  <div className={styles.featuredDate}>
                    <span>{ko ? "그날의 온기" : "A moment kept"}</span>
                    {featuredDate ? (
                      <time dateTime={featured.watchedAt || featured.createdAt}>
                        {featuredDate.toLocaleDateString(
                          ko ? "ko-KR" : "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            weekday: "short",
                          },
                        )}
                      </time>
                    ) : null}
                    <span className={styles.dateRule} />
                  </div>
                  <div className={styles.featuredBody}>
                    <Link
                      href={`/title/${featured.title.id}`}
                      className={styles.featuredCover}
                      aria-label={
                        ko
                          ? `${featured.title.name} 기록 보기`
                          : `Open ${featured.title.name}`
                      }
                    >
                      <RecordPoster log={featured} variant="featured" />
                    </Link>
                    <div className={styles.featuredStory}>
                      <p className={styles.eyebrow}>
                        {featured.title.type === "book"
                          ? tQuick("typeBook")
                          : featured.title.type === "series"
                            ? tQuick("typeSeriesModern")
                            : tQuick("typeMovie")}
                        {featuredYear ? ` · ${featuredYear}` : ""}
                      </p>
                      <h2>
                        <Link href={`/title/${featured.title.id}`}>
                          {featured.title.name}
                        </Link>
                      </h2>
                      {featured.title.author ||
                      featured.title.directors?.length ? (
                        <p className={styles.creator}>
                          {featured.title.author ||
                            featured.title.directors?.join(", ")}
                        </p>
                      ) : null}
                      <div className={styles.featuredStatus}>
                        <span>
                          {statusLabel(
                            featured.status,
                            featured.title.type,
                            tStatus,
                          )}
                        </span>
                        <RecordFeeling log={featured} />
                      </div>
                      <p className={styles.edition}>
                        <RecordEdition log={featured} />
                      </p>
                      <RecordMoment log={featured} />
                      {featured.note?.trim() ? (
                        <blockquote
                          ref={featuredNote}
                          className={styles.featuredNote}
                        >
                          <span className={styles.featuredNoteText}>
                            {formatNoteInline(featured.note)}
                          </span>
                        </blockquote>
                      ) : null}
                      <div className={styles.featuredActions}>
                        <Link
                          href={`/title/${featured.title.id}`}
                          className={styles.quietLink}
                        >
                          {ko ? "이 기록 펼치기" : "Open this memory"}
                          <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onShare(featured)}
                          aria-label={tQuick("createShareCard")}
                        >
                          <Share2 size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
                <section className={styles.monthEntries}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className={styles.eyebrow}>
                        {monthLabel(selected.key, locale)}
                      </p>
                      <h2>{ko ? "이 달에 남긴 시간" : "Moments this month"}</h2>
                    </div>
                    <Link href="/timeline" className={styles.quietLink}>
                      {ko ? "타임라인" : "Timeline"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  {selected.items
                    .filter((log) => log.id !== featured.id)
                    .slice(0, 6)
                    .map((log) => (
                      <Link
                        key={log.id}
                        href={`/title/${log.title.id}`}
                        className={styles.entry}
                      >
                        <time dateTime={log.watchedAt || log.createdAt}>
                          {recordDate(log)?.toLocaleDateString(
                            ko ? "ko-KR" : "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </time>
                        <RecordPoster log={log} variant="compact" />
                        <div>
                          <strong>{log.title.name}</strong>
                          <span>
                            {statusLabel(log.status, log.title.type, tStatus)}{" "}
                            <RecordEdition log={log} />
                          </span>
                          <RecordMoment log={log} />
                        </div>
                        <ArrowRight size={17} aria-hidden="true" />
                      </Link>
                    ))}
                  {selected.items.length === 1 ? (
                    <p className={styles.smallNote}>
                      {ko
                        ? "이 달에 남겨둔 순간이에요."
                        : "A moment you kept this month."}
                    </p>
                  ) : null}
                </section>
              </>
            ) : (
              <section
                className={styles.featured}
                data-testid="home-completed-month-empty"
                aria-labelledby="home-completed-month-empty-title"
              >
                <div className={styles.sectionHeading}>
                  <h2 id="home-completed-month-empty-title">
                    {ko
                      ? "다 본·읽은 이야기는 이곳에 모아둘게요."
                      : "Stories you finish watching or reading will gather here."}
                  </h2>
                </div>
                <p className={styles.smallNote}>
                  {ko
                    ? "이어가는 이야기와 아껴둔 작품은 타임라인에서 함께 볼 수 있어요."
                    : "Your ongoing stories and saved titles are together on your timeline."}
                </p>
                <Link href="/timeline" className={styles.quietLink}>
                  {ko ? "내 타임라인 펼치기" : "Open your timeline"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </section>
            )}
            {moments.length > 0 ? (
              <section
                className={styles.momentRevisit}
                aria-labelledby="home-moment-heading"
              >
                <div className={styles.sectionHeading}>
                  <div>
                    <p className={styles.eyebrow}>
                      {ko ? "다시 만나는 그날" : "BACK TO A MOMENT"}
                    </p>
                    <h2 id="home-moment-heading">
                      {ko
                        ? "어떤 순간을 펼쳐볼까요?"
                        : "Which moments will you revisit?"}
                    </h2>
                  </div>
                </div>
                <p className={styles.momentLead}>
                  {ko
                    ? "이 기기에 모아둔 기록에서 그날의 순간을 다시 만나요."
                    : "Revisit moments from the records kept on this device."}
                </p>
                <div className={styles.momentLinks}>
                  {moments.map((moment) => {
                    const Icon = moment.field === "place" ? MapPin : Users;
                    const label = tCommon(
                      `${moment.field === "place" ? "placeLabels" : "occasionLabels"}.${moment.value}`,
                    );
                    return (
                      <Link
                        key={`${moment.field}:${moment.value}`}
                        href={{
                          pathname: "/timeline",
                          query: { [moment.field]: moment.value },
                        }}
                        data-testid="home-moment-link"
                        data-moment-field={moment.field}
                        data-moment-value={moment.value}
                        data-moment-count={moment.count}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span>{label}</span>
                        <small>
                          {ko
                            ? `${moment.count}개`
                            : `${moment.count} ${moment.count === 1 ? "record" : "records"}`}
                        </small>
                        <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
          <aside className={styles.homeSide}>
            {continuing.length ? (
              <section className={styles.continuing}>
                <div className={styles.sectionHeading}>
                  <h2>
                    {ko ? "아직 못다 한 이야기" : "Stories still unfolding"}
                  </h2>
                </div>
                <div className={styles.continuingList}>
                  {continuing.map((log) => (
                    <article key={log.id} className={styles.continuingCard}>
                      <RecordPoster log={log} variant="compact" />
                      <div>
                        <p>
                          {statusLabel(log.status, log.title.type, tStatus)}
                        </p>
                        <h3>{log.title.name}</h3>
                        <span className={styles.edition}>
                          <RecordEdition log={log} />
                        </span>
                        <Link
                          href={`/title/${log.title.id}`}
                          className={styles.quietLink}
                        >
                          {ko ? "이어 적기" : "Keep going"}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            <Link href="/me/report" className={styles.sideLink}>
              <Clock3 size={18} aria-hidden="true" />
              <span>
                {ko ? "쌓아온 시간 돌아보기" : "Look back on your time"}
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            {ko && records.some((log) => log.title.type === "book") ? (
              <Link href="/me/bookshelf" className={styles.sideLink}>
                <BookOpen size={18} aria-hidden="true" />
                <span>내 서가 펼치기</span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ) : null}
            <p className={styles.smallNote}>
              {ko
                ? "서두르지 않아도 괜찮아요. 남기고 싶은 순간에 다시 만나요."
                : "No need to keep up. Come back when there’s something to keep."}
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
