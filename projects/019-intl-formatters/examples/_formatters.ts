// Intl constructors are slow: each one resolves the locale, loads CLDR data and
// builds patterns. Formatting with an existing instance is cheap. So in a UI
// that renders a list of 500 prices, `new Intl.NumberFormat()` per row is the
// expensive part, and `toLocaleString()` does exactly that on every call.
//
// One cache keyed by constructor + locale + options fixes it for every
// formatter type, with full types for each.

type IntlCtor<T, O> = new (locales?: string | readonly string[], options?: O) => T;

const caches = new WeakMap<object, Map<string, unknown>>();

export function formatter<T, O extends object>(
  Ctor: IntlCtor<T, O>,
  locale: string | readonly string[],
  options?: O,
): T {
  let cache = caches.get(Ctor);
  if (!cache) caches.set(Ctor, (cache = new Map()));

  // Option order doesn't change the result, so sort keys for a stable key.
  const key = JSON.stringify([locale, options ? sortKeys(options) : null]);
  let instance = cache.get(key) as T | undefined;
  if (!instance) cache.set(key, (instance = new Ctor(locale, options)));
  return instance;
}

function sortKeys(object: object): [string, unknown][] {
  return Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export const numberFormat = (locale: string, options?: Intl.NumberFormatOptions) =>
  formatter(Intl.NumberFormat, locale, options);

export const pluralRules = (locale: string, options?: Intl.PluralRulesOptions) =>
  formatter(Intl.PluralRules, locale, options);

export const relativeTimeFormat = (locale: string, options?: Intl.RelativeTimeFormatOptions) =>
  formatter(Intl.RelativeTimeFormat, locale, options);

export const listFormat = (locale: string, options?: Intl.ListFormatOptions) =>
  formatter(Intl.ListFormat, locale, options);

export const dateTimeFormat = (locale: string, options?: Intl.DateTimeFormatOptions) =>
  formatter(Intl.DateTimeFormat, locale, options);

// Tiny timing helper for the "is caching worth it" comparison in 03.
export function time(label: string, run: () => void): number {
  const start = performance.now();
  run();
  const ms = performance.now() - start;
  console.log(`${label}: ${ms.toFixed(1)} ms`);
  return ms;
}
