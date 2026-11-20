// 05 · formatToParts: style pieces of a formatted value without parsing it.
//
// Designs often want "$1,234" big and ".50" small, or a unit in a muted
// color. Splitting the formatted string on "." breaks the moment the locale
// uses a decimal comma. formatToParts returns typed pieces instead, so the
// component styles by meaning (integer, fraction, currency) in any locale.
import { renderToStaticMarkup } from "react-dom/server";
import { dateTimeFormat, numberFormat } from "./_formatters";
import { timeAgo } from "./_relative-time";

type PriceProps = { amount: number; currency: string; locale: string };

export function Price({ amount, currency, locale }: PriceProps) {
  const parts = numberFormat(locale, { style: "currency", currency }).formatToParts(amount);
  return (
    <span className="price">
      {parts.map((part, i) => (
        // Text stays in reading order, so screen readers and copy-paste get
        // the normal formatted string; only the styling differs.
        <span key={i} className={`price__${part.type}`}>
          {part.value}
        </span>
      ))}
    </span>
  );
}

// Relative time with a machine-readable <time> and the exact date on hover.
// The absolute date is also the accessible fallback when "2 days ago" is not
// enough (e.g. in a screenshot or an exported page).
type RelativeTimeProps = { date: Date; now: Date; locale: string; timeZone: string };

export function RelativeTime({ date, now, locale, timeZone }: RelativeTimeProps) {
  const full = dateTimeFormat(locale, { dateStyle: "full", timeStyle: "short", timeZone }).format(date);
  return (
    <time dateTime={date.toISOString()} title={full}>
      {timeAgo(date, { now, locale, timeZone })}
    </time>
  );
}

// Print a part list so the shape is visible.
const partsOf = (locale: string, currency: string) =>
  numberFormat(locale, { style: "currency", currency })
    .formatToParts(-1234.5)
    .map((p) => `${p.type}:${JSON.stringify(p.value)}`)
    .join(" ");
console.log(partsOf("en-US", "USD"));
console.log(partsOf("de-CH", "CHF"));
// → minusSign:"-" currency:"$" integer:"1" group:"," integer:"234" decimal:"." fraction:"50"
// → currency:"CHF" minusSign:"-" integer:"1" group:"'" integer:"234" decimal:"." fraction:"50"
// Swiss German groups with an apostrophe and puts the minus after the
// currency code. Any regex over the string would have needed to know both.

const markets = [["en-US", "USD"], ["de-DE", "EUR"], ["ja-JP", "JPY"]] as const;
for (const [locale, currency] of markets) {
  console.log(renderToStaticMarkup(<Price amount={1234.5} currency={currency} locale={locale} />));
}
// → <span class="price"><span class="price__currency">$</span><span class="price__integer">1</span><span class="price__group">,</span><span class="price__integer">234</span><span class="price__decimal">.</span><span class="price__fraction">50</span></span>
// → <span class="price"><span class="price__integer">1</span><span class="price__group">.</span><span class="price__integer">234</span><span class="price__decimal">,</span><span class="price__fraction">50</span><span class="price__literal"> </span><span class="price__currency">€</span></span>
// → <span class="price"><span class="price__currency">￥</span><span class="price__integer">1</span><span class="price__group">,</span><span class="price__integer">235</span></span>
// The same CSS (.price__fraction { font-size: .6em }) works for all three,
// and JPY simply has no fraction part to style.

const now = new Date("2026-11-19T12:00:00Z");
console.log(
  renderToStaticMarkup(
    <RelativeTime date={new Date("2026-11-17T09:15:00Z")} now={now} locale="en" timeZone="Europe/Istanbul" />,
  ),
);
// → <time dateTime="2026-11-17T09:15:00.000Z" title="Tuesday, November 17, 2026 at 12:15 PM">2 days ago</time>
