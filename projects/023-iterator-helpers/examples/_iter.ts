// Small building blocks the built-in helpers don't cover (yet).
// Everything here is a generator, so it composes with .map/.filter/.take
// and stays lazy: nothing runs until someone pulls a value.

/** 0, 1, 2, … up to (not including) `end`. Infinite when `end` is omitted. */
export function* range(start = 0, end = Infinity, step = 1): Generator<number, void, undefined> {
  for (let i = start; step > 0 ? i < end : i > end; i += step) yield i;
}

/** Groups items into arrays of `size`; the last group may be shorter. */
export function* chunk<T>(source: Iterable<T>, size: number): Generator<T[], void, undefined> {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  let group: T[] = [];
  for (const item of source) {
    group.push(item);
    if (group.length === size) {
      yield group;
      group = [];
    }
  }
  if (group.length > 0) yield group;
}

/** Yields each item the first time its key is seen. */
export function* uniqueBy<T, K>(source: Iterable<T>, key: (item: T) => K): Generator<T, void, undefined> {
  const seen = new Set<K>();
  for (const item of source) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    yield item;
  }
}

/** Wraps a function so every call is counted; used to show how much work a pipeline does. */
export function counted<A extends unknown[], R>(fn: (...args: A) => R) {
  const wrapped = (...args: A): R => {
    wrapped.calls++;
    return fn(...args);
  };
  wrapped.calls = 0;
  return wrapped;
}
