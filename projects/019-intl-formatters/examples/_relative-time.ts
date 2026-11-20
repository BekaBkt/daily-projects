// timeAgo() lives here so 02 and 05 can both use it without running 02's demo.
import { dateTimeFormat, relativeTimeFormat } from "./_formatters";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Calendar days in the viewer's time zone. Two timestamps 2 hours apart can be
// "yesterday" if midnight is between them, so days are compared as dates,
// never as elapsed / 24h.
function calendarDayNumber(date: Date, timeZone: string): number {
  const parts = dateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day")) / (24 * HOUR);
}

export function timeAgo(
  date: Date,
  {
    now = new Date(),
    locale = "en",
    timeZone = "UTC",
    style = "long",
  }: { now?: Date; locale?: string; timeZone?: string; style?: Intl.RelativeTimeFormatStyle } = {},
): string {
  const rtf = relativeTimeFormat(locale, { numeric: "auto", style });
  const elapsed = date.getTime() - now.getTime(); // negative = past

  // Within a day: elapsed time, truncated toward zero ("59 minutes ago" is
  // still minutes; rounding would say "1 hour ago" at 30 minutes).
  const abs = Math.abs(elapsed);
  if (abs < 45 * SECOND) return rtf.format(0, "second");
  if (abs < HOUR) return rtf.format(Math.trunc(elapsed / MINUTE), "minute");

  const days = calendarDayNumber(date, timeZone) - calendarDayNumber(now, timeZone);
  if (days === 0) return rtf.format(Math.trunc(elapsed / HOUR), "hour");
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  if (Math.abs(days) < 30) return rtf.format(Math.trunc(days / 7), "week");
  if (Math.abs(days) < 365) return rtf.format(Math.trunc(days / 30), "month");
  return rtf.format(Math.trunc(days / 365), "year");
}
