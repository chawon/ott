"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { Status } from "@/lib/types";
import { cn, statusOptionsForType } from "@/lib/utils";

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
const filterFieldClass =
  "flex min-w-0 flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:gap-2";
const filterSelectClass =
  "min-h-12 w-full select-base rounded-xl px-3 text-sm sm:w-auto";

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
  contentType,
  setContentType,
}: {
  status: Status | "ALL";
  setStatus: (s: Status | "ALL") => void;
  ott: string;
  setOtt: (s: string) => void;
  origin: "ALL" | "LOG" | "COMMENT";
  setOrigin: (s: "ALL" | "LOG" | "COMMENT") => void;
  contentType: "ALL" | "video" | "book";
  setContentType: (s: "ALL" | "video" | "book") => void;
}) {
  const tFilters = useTranslations("FiltersBar");
  const tQuick = useTranslations("QuickLogCard");
  const tStatus = useTranslations("Status");

  const [customOttOptions, setCustomOttOptions] = useState<string[]>([]);
  const isBookMode = contentType === "book";
  const platformGroups = isBookMode
    ? BOOK_PLATFORM_GROUPS
    : VIDEO_PLATFORM_GROUPS;
  const platformCustomKey = isBookMode ? BOOK_CUSTOM_KEY : VIDEO_CUSTOM_KEY;

  const statusOptions = useMemo(() => {
    return statusOptionsForType(isBookMode ? "book" : "movie", tStatus);
  }, [isBookMode, tStatus]);

  useEffect(() => {
    setCustomOttOptions(loadCustomOptions(platformCustomKey));
  }, [platformCustomKey]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <label className={filterFieldClass}>
          <div className="text-sm text-muted-foreground">
            {tFilters("contentLabel")}
          </div>
          <select
            value={contentType}
            onChange={(e) =>
              setContentType(e.target.value as "ALL" | "video" | "book")
            }
            className={filterSelectClass}
          >
            <option value="ALL">{tFilters("all")}</option>
            <option value="video">{tFilters("video")}</option>
            <option value="book">{tFilters("book")}</option>
          </select>
        </label>

        <label className={filterFieldClass}>
          <div className="text-sm text-muted-foreground">
            {tFilters("filterLabel")}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "ALL")}
            className={filterSelectClass}
          >
            <option value="ALL">{tFilters("all")}</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className={filterFieldClass}>
          <div className="text-sm text-muted-foreground">
            {tFilters("categoryLabel")}
          </div>
          <select
            value={origin}
            onChange={(e) =>
              setOrigin(e.target.value as "ALL" | "LOG" | "COMMENT")
            }
            className={filterSelectClass}
          >
            <option value="ALL">{tFilters("all")}</option>
            <option value="LOG">{tFilters("myLog")}</option>
            <option value="COMMENT">{tFilters("comment")}</option>
          </select>
        </label>

        {contentType !== "ALL" && (
          <label className={filterFieldClass}>
            <div className="text-sm text-muted-foreground">
              {tFilters("platformLabel")}
            </div>
            <select
              value={ott}
              onChange={(e) => setOtt(e.target.value)}
              className={cn(filterSelectClass, "sm:min-w-44 lg:max-w-[220px]")}
            >
              <option value="">{tFilters("all")}</option>
              {platformGroups.map((g) => {
                const groupLabel =
                  g.label === "OTT"
                    ? "OTT"
                    : tQuick(g.label as Parameters<typeof tQuick>[0]);
                return (
                  <optgroup key={g.label} label={groupLabel}>
                    <option value={`__group:${g.label}`}>
                      {tFilters("groupAll", { group: groupLabel })}
                    </option>
                    {g.options.map((o) => (
                      <option
                        key={o}
                        value={tQuick(o as Parameters<typeof tQuick>[0])}
                      >
                        {tQuick(o as Parameters<typeof tQuick>[0])}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              {customOttOptions.length > 0 ? (
                <optgroup label={tQuick("myInput")}>
                  {customOttOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
