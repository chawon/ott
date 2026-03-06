"use client";

import { useEffect, useMemo, useState } from "react";
import { Status, WatchLog } from "@/lib/types";
import { cn, statusOptionsForType } from "@/lib/utils";
import { useTranslations } from "next-intl";

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
    options: [
      "platformPublicLib",
      "platformUnivLib",
      "platformSchoolLib",
    ],
  },
] as const;

const OTT_CUSTOM_VALUE = "__custom__";
const VIDEO_CUSTOM_KEY = "watchlog.ott.custom";
const BOOK_CUSTOM_KEY = "watchlog.book.platform.custom";

function resolvePlatformSelect(
  value: string,
  options: string[],
  groups: readonly { label: string; options: readonly string[] }[],
) {
  if (!value) return "";
  if (value.includes(",")) {
    const picked = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const group of groups) {
      if (picked.length !== group.options.length) continue;
      // We don't have the translations here easily, so we just check if it is a group logic
      // In FiltersBar we manually handle groups
    }
    return OTT_CUSTOM_VALUE;
  }
  return options.includes(value) ? value : OTT_CUSTOM_VALUE;
}

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

  const [ottSelect, setOttSelect] = useState<string>("");
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

  useEffect(() => {
    if (contentType === "ALL") {
      setOttSelect("");
    }
  }, [contentType]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:flex-row md:items-center">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {tFilters("contentLabel")}
          </div>
          <select
            value={contentType}
            onChange={(e) =>
              setContentType(e.target.value as "ALL" | "video" | "book")
            }
            className="select-base rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">{tFilters("all")}</option>
            <option value="video">{tFilters("video")}</option>
            <option value="book">{tFilters("book")}</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {tFilters("filterLabel")}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status | "ALL")}
            className="select-base rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">{tFilters("all")}</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {tFilters("categoryLabel")}
          </div>
          <select
            value={origin}
            onChange={(e) =>
              setOrigin(e.target.value as "ALL" | "LOG" | "COMMENT")
            }
            className="select-base rounded-xl px-3 py-2 text-xs"
          >
            <option value="ALL">{tFilters("all")}</option>
            <option value="LOG">{tFilters("myLog")}</option>
            <option value="COMMENT">{tFilters("comment")}</option>
          </select>
        </label>

        {contentType !== "ALL" && (
          <label className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              {tFilters("platformLabel")}
            </div>
            <select
              value={ott}
              onChange={(e) => setOtt(e.target.value)}
              className="select-base rounded-xl px-3 py-2 text-xs max-w-[120px]"
            >
              <option value="">{tFilters("all")}</option>
              {platformGroups.map((g) => {
                const groupLabel =
                  g.label === "OTT" ? "OTT" : tQuick(g.label as any);
                return (
                  <optgroup key={g.label} label={groupLabel}>
                    <option value={`__group:${g.label}`}>
                      {tFilters("groupAll", { group: groupLabel })}
                    </option>
                    {g.options.map((o) => (
                      <option key={o} value={tQuick(o as any)}>
                        {tQuick(o as any)}
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
