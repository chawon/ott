import { WatchLog } from "./types";

type CounterMap = Record<string, number>;

export type PersonalReport = {
  totalLogs: number;
  thisMonthLogs: number;
  doneRatePct: number;
  ratingFillPct: number;
  noteFillPct: number;
  topType: string;
  topPlace: string;
  topOccasion: string;
  streakDays: number;
  longestStreakDays: number;
  lastLoggedAt: string | null;
};

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function maxEntry(counter: CounterMap): string {
  const entries = Object.entries(counter);
  if (!entries.length) return "-";
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function calcStreak(days: string[], today = new Date()): { current: number; longest: number } {
  if (!days.length) return { current: 0, longest: 0 };
  const sortedUnique = Array.from(new Set(days)).sort();

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedUnique.length; i += 1) {
    const prev = new Date(`${sortedUnique[i - 1]}T00:00:00`);
    const curr = new Date(`${sortedUnique[i]}T00:00:00`);
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  let current = 0;
  const todayKey = dayKey(today.toISOString());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday.toISOString());

  const activeStartKey = sortedUnique.includes(todayKey) ? todayKey : sortedUnique.includes(yesterdayKey) ? yesterdayKey : null;
  if (!activeStartKey) return { current: 0, longest };

  current = 1;
  let cursor = new Date(`${activeStartKey}T00:00:00`);
  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    const key = dayKey(cursor.toISOString());
    if (!sortedUnique.includes(key)) break;
    current += 1;
  }
  return { current, longest };
}

export function buildPersonalReport(logs: WatchLog[], now = new Date()): PersonalReport {
  if (!logs.length) {
    return {
      totalLogs: 0,
      thisMonthLogs: 0,
      doneRatePct: 0,
      ratingFillPct: 0,
      noteFillPct: 0,
      topType: "-",
      topPlace: "-",
      topOccasion: "-",
      streakDays: 0,
      longestStreakDays: 0,
      lastLoggedAt: null,
    };
  }

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  let thisMonthLogs = 0;
  let doneCount = 0;
  let ratingCount = 0;
  let noteCount = 0;
  let lastLoggedAt = logs[0].watchedAt;
  const types: CounterMap = {};
  const places: CounterMap = {};
  const occasions: CounterMap = {};
  const days: string[] = [];

  for (const log of logs) {
    const watchedDate = new Date(log.watchedAt);
    if (watchedDate.getFullYear() === currentYear && watchedDate.getMonth() === currentMonth) {
      thisMonthLogs += 1;
    }
    if (log.status === "DONE") doneCount += 1;
    if (typeof log.rating === "number") ratingCount += 1;
    if (typeof log.note === "string" && log.note.trim().length > 0) noteCount += 1;

    const typeKey = log.title?.type ?? "unknown";
    types[typeKey] = (types[typeKey] ?? 0) + 1;
    if (log.place) places[log.place] = (places[log.place] ?? 0) + 1;
    if (log.occasion) occasions[log.occasion] = (occasions[log.occasion] ?? 0) + 1;

    days.push(dayKey(log.watchedAt));
    if (new Date(lastLoggedAt).getTime() < watchedDate.getTime()) {
      lastLoggedAt = log.watchedAt;
    }
  }

  const streak = calcStreak(days, now);

  return {
    totalLogs: logs.length,
    thisMonthLogs,
    doneRatePct: pct(doneCount, logs.length),
    ratingFillPct: pct(ratingCount, logs.length),
    noteFillPct: pct(noteCount, logs.length),
    topType: maxEntry(types),
    topPlace: maxEntry(places),
    topOccasion: maxEntry(occasions),
    streakDays: streak.current,
    longestStreakDays: streak.longest,
    lastLoggedAt,
  };
}
