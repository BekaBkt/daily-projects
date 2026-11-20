# 019 · Intl Formatters for UI Copy

**Type:** TIL · **Stack:** TypeScript, React 19, Node 22 (`tsx`) · **Date:** 2026-11-20

Most UI strings with a number, a date or a list in them get built by hand: `n === 1 ? "" : "s"`, `names.join(", ")`, `"$" + price.toFixed(2)`, a homemade `timeAgo` with 24-hour buckets. All of those are English grammar dressed up as code. The `Intl` namespace already has the locale data (CLDR) for plurals, relative time, compact numbers, units, currencies, lists and date ranges, and it ships in every browser and in Node. These examples go through the formatters I actually reach for in product UI, show where the hand-written version breaks, and end with React components that style parts of a formatted value through `formatToParts` instead of string splitting.

## Key points

- **`01-plurals.ts`**: `Intl.PluralRules` returns a category, not a word. English has `one/other`, Russian and Polish have `one/few/many/other` (and disagree about 21), Arabic has six, Japanese one. A small `plural()` helper adds exact matches (`=0`) and passes the display digits to the rules so `1.0` correctly reads "1.0 stars". Ordinals (`1st 2nd 3rd 11th 21st`) use `type: "ordinal"`.
- **`02-relative-time.ts`** + **`_relative-time.ts`**: `Intl.RelativeTimeFormat` with `numeric: "auto"` gives "yesterday", "next week", "now", and Russian "позавчера". `timeAgo()` picks the unit itself: elapsed time under a day, calendar days in the viewer's time zone beyond that, so 22:30 → 00:30 is "yesterday" in UTC and "2 hours ago" in Almaty.
- **`03-numbers.ts`**: compact counts (`15.3K`, Japanese `1.5万`), units (`km/h`, `°C`), file sizes, currencies whose decimals come from the currency (JPY has none), signed deltas with `signDisplay: "exceptZero"`, `trailingZeroDisplay: "stripIfInteger"` for `$4` vs `$4.50`, and `formatRange` (`$3 – $5`, `~$3`). Formatted output contains non-breaking spaces, which is why string-based tests and `split(" ")` break.
- **`04-lists-and-ranges.ts`**: `Intl.ListFormat` handles "and"/"or", the Oxford comma (en vs en-GB) and Japanese `、`. "Aigerim, Ben, and 3 others" is just a list whose last item is the overflow count. `DateTimeFormat.formatRange` prints "Nov 19 – 21, 2026" and "10:00 – 11:30 AM" without repeating shared fields.
- **`05-format-parts.tsx`**: a `<Price>` that renders each `formatToParts` piece in its own span (`.price__fraction`, `.price__currency`), so one stylesheet works for `$1,234.50`, `1.234,50 €`, `CHF-1'234.50` and `￥1,235`. Visible text stays in reading order, so screen readers and copy-paste get the normal string. `<RelativeTime>` wraps `timeAgo()` in a `<time dateTime>` with the full date as its title.
- **`_formatters.ts`**: one typed cache for every Intl constructor, keyed by locale and sorted options. In `03`, 20k `toLocaleString()` calls took ~575 ms vs ~30 ms with a cached `NumberFormat`.

## What I practiced

- **Plural logic belongs to the locale, words belong to the catalog.** I stopped writing `n === 1` and started thinking in categories: the code asks `PluralRules` which form, and the translation provides one string per form, including the ones English doesn't have.
- **A relative date is a function of the time zone.** My old "divide by 86,400,000" approach was wrong around midnight. Comparing calendar dates from `formatToParts` in an explicit `timeZone` fixed it and made the tests deterministic.
- **Style by part type, never by parsing the formatted string.** `formatToParts` gave me the same structure in every locale, and caching formatter instances turned out to matter more for list performance than anything in the render itself.

## Run

```bash
npm install
npm run examples   # runs 01–05 with tsx; each file prints what it demonstrates
npm run typecheck  # strict tsc
```

Expected output is written under each `console.log` as `// →` comments. They come from Node 22 with ICU 78; older ICU data can differ in small details (spacing, abbreviations), which is another reason not to hard-code formatted strings in tests.
