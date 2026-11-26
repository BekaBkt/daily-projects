// 01 · Array chains do all the work up front. Iterator chains do only what's pulled.
//
// `arr.filter().map().slice(0, 5)` runs the predicate on every element,
// allocates two full intermediate arrays, then throws most of it away.
// ES2025 iterator helpers put the same methods on iterators: each value
// travels through the whole pipeline before the next one is read, and
// `.take(5)` stops pulling after the fifth result.
import { counted, range } from "./_iter";

type Product = { id: number; name: string; price: number; inStock: boolean };

const products: Product[] = range(0, 50_000)
  .map((id) => ({
    id,
    name: `Product ${id}`,
    price: 5 + ((id * 37) % 200),
    inStock: id % 3 !== 0,
  }))
  .toArray();

const isMatch = counted((p: Product) => p.inStock && p.price < 40);
const toRow = counted((p: Product) => `${p.name} · $${p.price}`);

// ✗ Eager: every product is tested, every match is formatted.
const eager = products.filter(isMatch).map(toRow).slice(0, 5);
console.log("eager", { predicate: isMatch.calls, format: toRow.calls }, eager.length);
// → eager { predicate: 50000, format: 5836 } 5

isMatch.calls = 0;
toRow.calls = 0;

// ✓ Lazy: same shape, `.values()` in front, `.toArray()` at the end.
const lazy = products.values().filter(isMatch).map(toRow).take(5).toArray();
console.log("lazy ", { predicate: isMatch.calls, format: toRow.calls }, lazy.length);
// → lazy  { predicate: 45, format: 5 } 5

console.log(lazy.join("\n"));
// → Product 11 · $12
// → Product 17 · $34
// → Product 22 · $19
// → Product 38 · $11
// → Product 44 · $33

// Order of evaluation is per item, not per stage. This is what makes it lazy.
const log: string[] = [];
[1, 2, 3]
  .values()
  .map((n) => (log.push(`map ${n}`), n * 10))
  .filter((n) => (log.push(`filter ${n}`), n > 10))
  .take(1)
  .toArray();
console.log(log.join(" → "));
// → map 1 → filter 10 → map 2 → filter 20

// Infinite sources are fine as long as something downstream stops.
const firstSquaresOver1000 = range()
  .map((n) => n * n)
  .filter((n) => n > 1000)
  .take(3)
  .toArray();
console.log(firstSquaresOver1000);
// → [ 1024, 1089, 1156 ]

// Short-circuiting terminals stop early too: find, some, every.
const cheapest = products.values().find((p) => p.price === 5);
console.log(cheapest?.id);
// → 0
