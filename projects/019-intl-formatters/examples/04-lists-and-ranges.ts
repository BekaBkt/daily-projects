// 04 · Lists and date ranges: two things everyone concatenates by hand.
//
// `names.join(", ")` has no "and", the Oxford comma is a per-locale choice,
// and "Nov 19 – Nov 21, 2026" repeats what the reader already knows.
import { dateTimeFormat, listFormat, pluralRules } from "./_formatters";

const people = ["Aigerim", "Ben", "Chen"];

for (const locale of ["en", "en-GB", "de", "ru", "ja"]) {
  console.log(locale.padEnd(6), listFormat(locale, { type: "conjunction" }).format(people));
}
// → en     Aigerim, Ben, and Chen
// → en-GB  Aigerim, Ben and Chen
// → de     Aigerim, Ben und Chen
// → ru     Aigerim, Ben и Chen
// → ja     Aigerim、Ben、Chen

// "or" lists for hints, "unit" lists for measurements.
console.log(listFormat("en", { type: "disjunction" }).format(["PNG", "JPG", "WebP"]));
console.log(listFormat("en", { type: "unit", style: "narrow" }).format(["5h", "30m"]));
// → PNG, JPG, or WebP
// → 5h 30m

// "Liked by Aigerim, Ben and 3 others": the overflow becomes the last list
// item, so the locale's own "and" joins it, and its count is pluralized.
export function namesWithOverflow(names: readonly string[], max: number, locale = "en"): string {
  const list = listFormat(locale, { type: "conjunction" });
  if (names.length <= max) return list.format(names);
  const rest = names.length - max;
  // English-only words here; in a real app this string comes from the
  // message catalog, picked with the same PluralRules as in 01.
  const others = pluralRules(locale).select(rest) === "one" ? "other" : "others";
  return list.format([...names.slice(0, max), `${rest} ${others}`]);
}
const likers = ["Aigerim", "Ben", "Chen", "Dana", "Emil"];
console.log([1, 2, 4, 5].map((n) => namesWithOverflow(likers.slice(0, n), 2)).join(" | "));
// → Aigerim | Aigerim and Ben | Aigerim, Ben, and 2 others | Aigerim, Ben, and 3 others
// (en-GB drops the serial comma, so the same call there reads "Aigerim, Ben and 3 others".)

// Date ranges: formatRange only prints the fields that differ.
const day = dateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });
const d = (iso: string) => new Date(iso);
console.log(day.formatRange(d("2026-11-19"), d("2026-11-21")));
console.log(day.formatRange(d("2026-11-29"), d("2026-12-02")));
console.log(day.formatRange(d("2026-12-30"), d("2027-01-02")));
// → Nov 19 – 21, 2026
// → Nov 29 – Dec 2, 2026
// → Dec 30, 2026 – Jan 2, 2027

// A meeting: one date, two times. The time zone is explicit; without it the
// server's zone leaks into the output.
const meeting = dateTimeFormat("en", {
  weekday: "short", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", timeZone: "Europe/Istanbul",
});
console.log(meeting.formatRange(d("2026-11-19T07:00:00Z"), d("2026-11-19T08:30:00Z")));
const meetingDe = dateTimeFormat("de", {
  weekday: "short", day: "numeric", month: "short",
  hour: "numeric", minute: "2-digit", timeZone: "Europe/Istanbul",
});
console.log(meetingDe.formatRange(d("2026-11-19T07:00:00Z"), d("2026-11-19T08:30:00Z")));
// → Thu, Nov 19, 10:00 – 11:30 AM
// → Do., 19. Nov., 10:00–11:30 Uhr
// German defaults to a 24-hour clock; English shares one "AM" for both ends.
