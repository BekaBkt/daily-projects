// 03 · Things that bit me after switching from arrays to iterators.
//
// (Top-level await below, so this file is a module.)
export {};

// 1. Iterators are single-use. An array can be read twice; an iterator is a
//    cursor, and the second read starts where the first stopped (the end).
const visible = ["a", "b", "c"].values().filter((x) => x !== "b");
console.log(visible.toArray(), visible.toArray());
// → [ 'a', 'c' ] []
// Keep the *source* (array, Set, a function returning a fresh iterator) and
// build the pipeline where it's consumed.
const visibleOf = (items: Iterable<string>) => Iterator.from(items).filter((x) => x !== "b");
const items = ["a", "b", "c"];
console.log(visibleOf(items).toArray(), visibleOf(items).toArray());
// → [ 'a', 'c' ] [ 'a', 'c' ]

// 2. Stopping early closes the source. take() calls return() on the
//    underlying generator, so its `finally` runs. Good for cleanup (closing a
//    cursor, releasing a lock), surprising if you planned to resume it later.
function* rows() {
  try {
    for (let i = 1; ; i++) yield i;
  } finally {
    console.log("rows(): closed");
  }
}
const source = rows();
console.log(source.take(2).toArray());
// → rows(): closed
// → [ 1, 2 ]
console.log(source.next());
// → { value: undefined, done: true }
// To "pause" a source, don't hand it to take(); pull with next() yourself.

// 3. flatMap refuses strings. Array#flatMap would treat "ab" as a value;
//    Iterator#flatMap only flattens iterators/iterables that are objects, and
//    throws for string primitives so it doesn't silently split them into chars.
try {
  ["x"].values().flatMap(() => "ab" as unknown as Iterable<string>).toArray();
} catch (error) {
  console.log((error as Error).constructor.name);
}
// → TypeError
console.log(["x"].values().flatMap(() => ["a", "b"]).toArray());
// → [ 'a', 'b' ]

// 4. A string iterator walks code points, not what users see as characters.
//    take(2) on "👍🏽ok" gives the thumb and the skin tone modifier separately.
console.log(Iterator.from("👍🏽ok").take(2).toArray());
// → [ '👍', '🏽' ]
// For user-visible characters, iterate Intl.Segmenter segments instead (see 007).
const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" }).segment("👍🏽ok");
console.log(Iterator.from(graphemes).map((s) => s.segment).take(2).toArray());
// → [ '👍🏽', 'o' ]

// 5. Negative or NaN counts throw instead of clamping like slice().
try {
  [1, 2, 3].values().take(-1);
} catch (error) {
  console.log((error as Error).constructor.name);
}
// → RangeError

// 6. There are no async helpers yet (AsyncIterator.prototype.map is a
//    separate, later proposal). For streams and paginated APIs I still write
//    async generators by hand. They read almost the same.
async function* mapAsync<T, R>(source: AsyncIterable<T>, fn: (item: T) => R | Promise<R>) {
  for await (const item of source) yield await fn(item);
}
async function* takeAsync<T>(source: AsyncIterable<T>, count: number) {
  if (count <= 0) return;
  let taken = 0;
  for await (const item of source) {
    yield item;
    if (++taken >= count) return; // `return` here closes `source`, same as take()
  }
}
async function* fetchPages() {
  for (let page = 1; ; page++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    console.log(`fetched page ${page}`);
    yield { page, users: [`user${page * 2 - 1}`, `user${page * 2}`] };
  }
}
const firstUsers = await Array.fromAsync(
  takeAsync(mapAsync(fetchPages(), (p) => p.users.join("+")), 2),
);
console.log(firstUsers);
// → fetched page 1
// → fetched page 2
// → [ 'user1+user2', 'user3+user4' ]
// Only two requests went out: the async pipeline is lazy in the same way.
