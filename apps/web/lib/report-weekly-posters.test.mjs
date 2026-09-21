import assert from "node:assert/strict";
import test from "node:test";

import { buildPersonalReport } from "./report.ts";
import { buildWeeklyRecapSharePayload } from "./share.ts";

function log(overrides = {}) {
  return {
    id: overrides.id ?? "log-1",
    title: {
      id: overrides.title?.id ?? "title-1",
      type: overrides.title?.type ?? "movie",
      name: overrides.title?.name ?? "Poster Movie",
      posterUrl:
        overrides.title?.posterUrl ?? "https://image.example/main-poster.jpg",
      genres: overrides.title?.genres ?? [],
    },
    status: overrides.status ?? "DONE",
    spoiler: false,
    watchedAt: overrides.watchedAt,
    createdAt: overrides.createdAt ?? overrides.watchedAt,
    seasonPosterUrl: overrides.seasonPosterUrl,
    ...overrides,
  };
}

test("weekly report share payload contains posters from the previous week", () => {
  const report = buildPersonalReport(
    [
      log({
        id: "previous-week-1",
        watchedAt: "2026-09-16T20:00:00+09:00",
        seasonPosterUrl: "https://image.example/season-poster.jpg",
      }),
      log({
        id: "previous-week-2",
        watchedAt: "2026-09-18T20:00:00+09:00",
      }),
      log({
        id: "current-week",
        title: {
          id: "title-2",
          type: "book",
          name: "Current Week Book",
          posterUrl: "https://image.example/current-week.jpg",
        },
        watchedAt: "2026-09-21T10:00:00+09:00",
      }),
    ],
    new Date("2026-09-21T12:00:00+09:00"),
  );

  const payload = buildWeeklyRecapSharePayload(report, {
    title: "지난주 기록 회고",
    subtitle: "지난주 남긴 2개의 기록을 한 장에 모았습니다.",
    weeklyRecordsLabel: "지난주 기록",
    totalRecordsLabel: "총 기록",
    streakLabel: "연속 기록",
  });

  assert.equal(report.previousWeekLogs, 2);
  assert.deepEqual(payload.posterItems, [
    {
      title: "Poster Movie",
      titleType: "movie",
      posterUrl: "https://image.example/season-poster.jpg",
      count: 2,
    },
  ]);
});
