"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import type { Occasion, Place, Status } from "@/lib/types";
import {
  OCCASION_LABELS,
  PLACE_LABELS,
  statusOptionsForType,
} from "@/lib/utils";
import styles from "./timeline-v2/timeline.module.css";

const VIDEO_PLATFORM_GROUPS = [
  {
    label: "OTT",
    options: [
      "platformNetflix",
      "platformDisney",
      "platformTving",
      "platformWavve",
      "platformCoupang",
      "platformApple",
      "platformPrime",
      "platformWatcha",
    ],
  },
  { label: "groupPaidTv", options: ["platformChannel", "platformVod"] },
  { label: "groupPhysical", options: ["platformDvd", "platformBluray"] },
  {
    label: "groupTheater",
    options: [
      "platformCgv",
      "platformLotte",
      "platformMegabox",
      "platformCineQ",
    ],
  },
] as const;

const BOOK_PLATFORM_GROUPS = [
  {
    label: "groupBookstore",
    options: [
      "platformKyobo",
      "platformYeongpung",
      "platformYes24",
      "platformAladin",
    ],
  },
  {
    label: "groupEbook",
    options: [
      "platformRidi",
      "platformMillie",
      "platformWilla",
      "platformPlaybook",
    ],
  },
  {
    label: "groupLibrary",
    options: ["platformPublicLib", "platformUnivLib", "platformSchoolLib"],
  },
] as const;

const VIDEO_CUSTOM_KEY = "watchlog.ott.custom";
const BOOK_CUSTOM_KEY = "watchlog.book.platform.custom";
function loadCustomOptions(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => typeof v === "string" && v.trim().length > 0);
  } catch {
    return [];
  }
}

export default function FiltersBar({
  status,
  setStatus,
  ott,
  setOtt,
  origin,
  setOrigin,
  query,
  setQuery,
  contentType,
  setContentType,
  place,
  setPlace,
  occasion,
  setOccasion,
}: {
  place: Place | "";
  setPlace: (value: Place | "") => void;
  occasion: Occasion | "";
  setOccasion: (value: Occasion | "") => void;
  status: Status | "ALL";
  setStatus: (s: Status | "ALL") => void;
  ott: string;
  setOtt: (s: string) => void;
  origin: "ALL" | "LOG" | "COMMENT";
  setOrigin: (s: "ALL" | "LOG" | "COMMENT") => void;
  query: string;
  setQuery: (s: string) => void;
  contentType: "ALL" | "video" | "book";
  setContentType: (s: "ALL" | "video" | "book") => void;
}) {
  const locale = useLocale();
  const ko = locale === "ko";
  const tCommon = useTranslations("Common");
  const tFilters = useTranslations("FiltersBar");
  const tQuick = useTranslations("QuickLogCard");
  const tStatus = useTranslations("Status");

  const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
  const isBookMode = contentType === "book";
  const platformGroups =
    contentType === "ALL"
      ? [...VIDEO_PLATFORM_GROUPS, ...BOOK_PLATFORM_GROUPS]
      : isBookMode
        ? BOOK_PLATFORM_GROUPS
        : VIDEO_PLATFORM_GROUPS;
  const platformCustomKey = isBookMode ? BOOK_CUSTOM_KEY : VIDEO_CUSTOM_KEY;

  const statusOptions = useMemo(() => {
    return statusOptionsForType(isBookMode ? "book" : "movie", tStatus);
  }, [isBookMode, tStatus]);

  useEffect(() => {
    setCustomOttOptions(
      contentType === "ALL"
        ? [
            ...new Set([
              ...loadCustomOptions(VIDEO_CUSTOM_KEY),
              ...loadCustomOptions(BOOK_CUSTOM_KEY),
            ]),
          ]
        : loadCustomOptions(platformCustomKey),
    );
  }, [contentType, platformCustomKey]);

  const active =
    status !== "ALL" ||
    origin !== "ALL" ||
    Boolean(ott || query || place || occasion);
  const momentCount = [
    status !== "ALL",
    Boolean(ott),
    Boolean(place),
    Boolean(occasion),
    origin !== "ALL",
  ].filter(Boolean).length;
  const [momentsOpen, setMomentsOpen] = useState(momentCount > 0);
  const momentFieldsId = useId();
  useEffect(() => {
    if (status !== "ALL" || ott || place || occasion || origin !== "ALL")
      setMomentsOpen(true);
  }, [status, ott, place, occasion, origin]);
  return (
    <section
      className={styles.filterBar}
      aria-label={ko ? "타임라인에서 찾기" : "Find a record"}
    >
      <div className={styles.filterTop}>
        <fieldset className={styles.typeTabs}>
          <legend className="sr-only">{tFilters("contentLabel")}</legend>
          {(["ALL", "video", "book"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={contentType === type}
              onClick={() => setContentType(type)}
            >
              {tFilters(type === "ALL" ? "all" : type)}
            </button>
          ))}
        </fieldset>
        <label className={styles.searchField}>
          <span className="sr-only">{tFilters("searchLabel")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tFilters("searchPlaceholder")}
          />
        </label>
      </div>
      <button
        type="button"
        className={styles.momentToggle}
        data-testid="timeline-moment-toggle"
        aria-expanded={momentsOpen}
        aria-controls={momentFieldsId}
        onClick={() => setMomentsOpen((open) => !open)}
      >
        <span>{ko ? "그날의 순간으로 찾기" : "Find a moment"}</span>
        {momentCount > 0 ? (
          <span
            className={styles.momentCount}
            data-testid="timeline-moment-count"
          >
            {momentCount}
            <span className="sr-only">
              {ko ? "개 조건 선택" : " filters selected"}
            </span>
          </span>
        ) : null}
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div
        id={momentFieldsId}
        className={styles.filterFields}
        data-testid="timeline-moment-fields"
        data-expanded={momentsOpen}
      >
        <label>
          <span>{tFilters("filterLabel")}</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as Status | "ALL")
            }
          >
            <option value="ALL">{tFilters("all")}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{tFilters("platformLabel")}</span>
          <select value={ott} onChange={(event) => setOtt(event.target.value)}>
            <option value="">{tFilters("all")}</option>
            {platformGroups.map((group) => (
              <optgroup
                key={group.label}
                label={group.label === "OTT" ? "OTT" : tQuick(group.label)}
              >
                {group.options.map((option) => (
                  <option key={option} value={tQuick(option)}>
                    {tQuick(option)}
                  </option>
                ))}
              </optgroup>
            ))}
            {customOttOptions.length ? (
              <optgroup label={tQuick("myInput")}>
                {customOttOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label>
          <span>{ko ? "어디서" : "Where"}</span>
          <select
            value={place}
            onChange={(event) => setPlace(event.target.value as Place | "")}
          >
            <option value="">{ko ? "모든 장소" : "Every place"}</option>
            {Object.keys(PLACE_LABELS).map((value) => (
              <option key={value} value={value}>
                {tCommon(`placeLabels.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            {ko ? "누구와·어떤 상황" : "Who you were with or the occasion"}
          </span>
          <select
            value={occasion}
            onChange={(event) =>
              setOccasion(event.target.value as Occasion | "")
            }
          >
            <option value="">{ko ? "모든 상황" : "Every occasion"}</option>
            {Object.keys(OCCASION_LABELS).map((value) => (
              <option key={value} value={value}>
                {tCommon(`occasionLabels.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{tFilters("categoryLabel")}</span>
          <select
            value={origin}
            onChange={(event) =>
              setOrigin(event.target.value as "ALL" | "LOG" | "COMMENT")
            }
          >
            <option value="ALL">{tFilters("all")}</option>
            <option value="LOG">{tFilters("myLog")}</option>
            <option value="COMMENT">{tFilters("comment")}</option>
          </select>
        </label>
      </div>
      {active ? (
        <div className={styles.filterSummary}>
          <p>
            {ko
              ? "고른 조건에 맞는 기록을 펼쳤어요."
              : "Showing the records that match your choices."}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("ALL");
              setOrigin("ALL");
              setOtt("");
              setQuery("");
              setPlace("");
              setOccasion("");
              setMomentsOpen(false);
            }}
          >
            {ko ? "조건 지우기" : "Clear filters"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
