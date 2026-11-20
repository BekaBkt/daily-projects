// 03 · Intl.NumberFormat does far more than thousands separators.
//
// Compact counts, units, currencies, signed deltas and ranges are all built
// in, and they get the locale details right (decimal comma, symbol position,
// non-breaking spaces) that string templates get wrong.
import { numberFormat, time } from "./_formatters";

const show = (label: string, value: string) => console.log(label.padEnd(18), JSON.stringify(value));

// Compact notation: follower counts, view counts, stars.
const compact = (locale: string) => numberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
show("compact en", [999, 1234, 15_300, 2_480_000].map((n) => compact("en").format(n)).join(" "));
show("compact ja", compact("ja").format(15_300));
show("compact de", compact("de").format(2_480_000));
// → compact en         "999 1.2K 15.3K 2.5M"
// → compact ja         "1.5万"
// → compact de         "2,5 Mio."
// Japanese groups by 10,000 (万), not 1,000. A hand-rolled "K/M" can't do that.

// Units, including the long/short/narrow forms.
show("speed", numberFormat("en", { style: "unit", unit: "kilometer-per-hour" }).format(88));
show("duration long", numberFormat("en", { style: "unit", unit: "minute", unitDisplay: "long" }).format(1));
show("temperature", numberFormat("fr", { style: "unit", unit: "celsius" }).format(-3.5));
// → speed              "88 km/h"
// → duration long      "1 minute"
// → temperature        "-3,5 °C"

// File sizes: pick the unit, let Intl format it.
const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"] as const;
export function formatBytes(bytes: number, locale = "en"): string {
  const exponent = Math.min(Math.floor(Math.log10(Math.max(bytes, 1)) / 3), BYTE_UNITS.length - 1);
  return numberFormat(locale, {
    style: "unit",
    unit: BYTE_UNITS[exponent],
    // "512 byte" reads wrong; plain bytes get the long, pluralized form.
    unitDisplay: exponent === 0 ? "long" : "short",
    maximumFractionDigits: exponent === 0 ? 0 : 1,
  }).format(bytes / 1000 ** exponent);
}
show("bytes", [0, 512, 48_213, 7_340_032, 1.2e12].map((n) => formatBytes(n)).join(" | "));
// → bytes              "0 bytes | 512 bytes | 48.2 kB | 7.3 MB | 1.2 TB"

// Currency. The currency decides the decimals (JPY has none), the locale
// decides symbol position and separators.
const money = (locale: string, currency: string, n: number) =>
  numberFormat(locale, { style: "currency", currency }).format(n);
show("USD en-US", money("en-US", "USD", 1234.5));
show("EUR de-DE", money("de-DE", "EUR", 1234.5));
show("JPY ja-JP", money("ja-JP", "JPY", 1234.5));
show("KZT kk-KZ", money("kk-KZ", "KZT", 1234.5));
// → USD en-US          "$1,234.50"
// → EUR de-DE          "1.234,50 €"
// → JPY ja-JP          "￥1,235"
// → KZT kk-KZ          "1 234,50 ₸"
// Those spaces are U+00A0 / U+202F, so `price.split(" ")` and snapshot tests
// written with plain spaces both break. Compare against Intl output instead.

// Signed deltas for dashboards: "+12%" and "−3%", but zero gets no sign.
const delta = numberFormat("en", { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 });
show("deltas", [0.123, -0.031, 0].map((n) => delta.format(n)).join(" "));
// → deltas             "+12.3% -3.1% 0%"

// Price where whole amounts drop the ".00", but $4.50 keeps both digits.
const price = numberFormat("en", { style: "currency", currency: "USD", trailingZeroDisplay: "stripIfInteger" });
show("strip .00", [4, 4.5, 4.99].map((n) => price.format(n)).join(" "));
// → strip .00          "$4 $4.50 $4.99"

// Ranges collapse shared parts and switch to "~" when both ends round equal.
const usd0 = numberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
show("range", usd0.formatRange(3, 5));
show("range ≈", usd0.formatRange(2.9, 3.1));
show("range de", numberFormat("de", { style: "currency", currency: "EUR" }).formatRange(3, 5));
// → range              "$3 – $5"
// → range ≈            "~$3"
// → range de           "3,00–5,00 €"

// Why the cache in _formatters.ts exists. Numbers are machine-dependent, the
// ratio is the point: toLocaleString builds a formatter on every call.
const values = Array.from({ length: 20_000 }, (_, i) => i * 1.37);
const options: Intl.NumberFormatOptions = { style: "currency", currency: "EUR" };
const slow = time("toLocaleString x20k", () => values.forEach((n) => n.toLocaleString("de-DE", options)));
const fast = time("cached format x20k", () => values.forEach((n) => numberFormat("de-DE", options).format(n)));
console.log(`cached is ~${Math.round(slow / fast)}x faster`);
// → toLocaleString x20k: 574.7 ms
// → cached format x20k: 29.5 ms
// → cached is ~19x faster
