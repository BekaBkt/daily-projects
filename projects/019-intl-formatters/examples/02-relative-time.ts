// 02 · "3 hours ago" without a date library.
//
// Intl.RelativeTimeFormat only formats (value, unit). Picking the unit and
// deciding what "yesterday" means is on you, and that's where the bugs are.
import { relativeTimeFormat } from "./_formatters";
import { timeAgo } from "./_relative-time";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const rtfAuto = relativeTimeFormat("en", { numeric: "auto" });
const rtfAlways = relativeTimeFormat("en", { numeric: "always" });

// numeric: "auto" turns ±1 (and 0) into words where the language has them.
console.log(rtfAlways.format(-1, "day"), "|", rtfAuto.format(-1, "day"));
// → 1 day ago | yesterday
console.log(rtfAuto.format(0, "second"), "|", rtfAuto.format(1, "week"), "|", rtfAuto.format(-1, "month"));
// → now | next week | last month
console.log(relativeTimeFormat("ru", { numeric: "auto" }).format(-2, "day"));
// → позавчера  ("the day before yesterday", a word English doesn't have)

// timeAgo() is in _relative-time.ts. Within a day it uses elapsed time,
// truncated toward zero ("59 minutes ago" is still minutes; rounding would
// say "1 hour ago" at 30 minutes). Beyond that it compares calendar days in
// the viewer's time zone: two timestamps 2 hours apart can be "yesterday" if
// midnight is between them, so days are compared as dates, never as
// elapsed / 24h.

const now = new Date("2026-11-19T00:30:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

const samples: [string, Date][] = [
  ["10 s", ago(10 * SECOND)],
  ["59 min", ago(59 * MINUTE)],
  ["2 h (22:30 UTC)", ago(2 * HOUR)],
  ["30 h", ago(30 * HOUR)],
  ["9 days", ago(9 * DAY)],
  ["in 3 days", ago(-3 * DAY)],
  ["400 days", ago(400 * DAY)],
];
for (const [label, date] of samples) {
  console.log(
    label.padEnd(16),
    timeAgo(date, { now }).padEnd(14),
    timeAgo(date, { now, timeZone: "Asia/Almaty" }).padEnd(14),
    timeAgo(date, { now, locale: "de", style: "short" }),
  );
}
// → 10 s             now            now            jetzt
// → 59 min           59 minutes ago 59 minutes ago vor 59 Min.
// → 2 h (22:30 UTC)  yesterday      2 hours ago    gestern
// → 30 h             2 days ago     2 days ago     vorgestern
// → 9 days           last week      last week      letzte Woche
// → in 3 days        in 3 days      in 3 days      in 3 Tagen
// → 400 days         last year      last year      letztes Jahr
// Same instant, two answers: in UTC 22:30 was yesterday, in Almaty (UTC+5)
// both times fall on Nov 19. The time zone is part of the input. And 30 hours
// is "2 days ago", not "1 day ago": it started on Nov 17.
