import type { Schedule } from "./cron";

/**
 * Vixie cron rule: if day-of-month and day-of-week are both restricted,
 * a day matches when EITHER matches. A field counts as unrestricted when it
 * starts with `*` (so `*\/2` is still "unrestricted" for this check, like cron).
 */
export function dayMatches(schedule: Schedule, date: Date): boolean {
  const { dayOfMonth, dayOfWeek } = schedule;
  const domOk = dayOfMonth.values.includes(date.getDate());
  const dowOk = dayOfWeek.values.includes(date.getDay());
  const domStar = dayOfMonth.source.startsWith("*");
  const dowStar = dayOfWeek.source.startsWith("*");

  if (domStar || dowStar) return domOk && dowOk;
  return domOk || dowOk;
}

/** Five years covers every leap-day schedule; anything later never fires. */
const SEARCH_YEARS = 5;

/**
 * Next `count` fire times strictly after `from`, in local time.
 * Jumps a whole month / day / hour at a time when a coarser field fails,
 * so even sparse schedules (`0 0 29 2 *`) resolve in a few hundred steps.
 */
export function nextRuns(schedule: Schedule, from: Date, count: number): Date[] {
  const runs: Date[] = [];
  const cursor = new Date(from);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const limit = new Date(cursor);
  limit.setFullYear(limit.getFullYear() + SEARCH_YEARS);

  const { minute, hour, month } = schedule;

  while (runs.length < count && cursor < limit) {
    if (!month.values.includes(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(schedule, cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hour.values.includes(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minute.values.includes(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }
    runs.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
  }
  return runs;
}
