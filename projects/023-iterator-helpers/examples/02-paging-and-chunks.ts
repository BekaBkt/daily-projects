// 02 · drop/take for pages, flatMap for groups, Iterator.from for anything.
//
// The helpers work on every built-in iterator (Map/Set entries, generators,
// matchAll, string iterators) and on any object with a `next()` once it is
// wrapped in Iterator.from. That's what makes them useful beyond arrays.
import { chunk, range, uniqueBy } from "./_iter";

// Paging: page N is drop(N * size).take(size). On a generator source the
// skipped items are still produced (drop is not random access), but nothing
// after the page is.
function page<T>(source: Iterable<T>, index: number, size: number): T[] {
  return Iterator.from(source).drop(index * size).take(size).toArray();
}
console.log(page(range(1, 100), 2, 5));
// → [ 11, 12, 13, 14, 15 ]

// The map/filter callbacks get a counter as the second argument (there is no
// third "array" argument; an iterator has no array to give you).
const ranked = ["Aigerim", "Ben", "Chen"].values().map((name, i) => `${i + 1}. ${name}`).toArray();
console.log(ranked);
// → [ '1. Aigerim', '2. Ben', '3. Chen' ]

// Maps: entries() is an iterator, so no Array.from(map) round trip.
const unread = new Map([
  ["inbox", 12],
  ["drafts", 0],
  ["spam", 3],
]);
const badges = unread
  .entries()
  .filter(([, count]) => count > 0)
  .map(([folder, count]) => `${folder} (${count})`)
  .toArray();
console.log(badges);
// → [ 'inbox (12)', 'spam (3)' ]

// flatMap flattens one level of grouped data: sections → rows.
const sections = [
  { title: "Today", items: ["Standup", "Review PR #41"] },
  { title: "Tomorrow", items: [] },
  { title: "Friday", items: ["Demo", "Retro"] },
];
const rows = sections
  .values()
  .flatMap((s) => [{ kind: "header" as const, label: s.title }, ...s.items.map((label) => ({ kind: "item" as const, label }))])
  .toArray();
console.log(rows.map((r) => (r.kind === "header" ? `# ${r.label}` : `  ${r.label}`)).join("\n"));
// → # Today
// →   Standup
// →   Review PR #41
// → # Tomorrow
// → # Friday
// →   Demo
// →   Retro

// matchAll returns an iterator: pull only the first few @mentions.
const message = "thanks @aigerim and @ben, cc @chen @aigerim @dana";
const mentions = uniqueBy(
  message.matchAll(/@(\w+)/g).map((m) => m[1]!),
  (name) => name,
)
  .take(3)
  .toArray();
console.log(mentions);
// → [ 'aigerim', 'ben', 'chen' ]

// Custom generators compose with built-ins: batch ids for an API that
// accepts at most 3 per request.
const ids = new Set([101, 102, 103, 104, 105, 106, 107]);
for (const batch of chunk(ids.values().filter((id) => id !== 104), 3)) {
  console.log(`GET /users?ids=${batch.join(",")}`);
}
// → GET /users?ids=101,102,103
// → GET /users?ids=105,106,107

// Iterator.from wraps a hand-written iterator (just a `next()` method) and
// gives it the full helper prototype.
let seed = 42;
const randomIds = Iterator.from({
  next: () => ({ done: false, value: (seed = (seed * 48271) % 2147483647) % 1000 }),
});
console.log(randomIds.take(4).toArray());
// → [ 382, 407, 37, 815 ]  (Park–Miller LCG, so the same every run)
