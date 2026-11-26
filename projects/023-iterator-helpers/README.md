# 023 · Iterator Helpers and Set Methods

**Type:** TIL · **Stack:** TypeScript, React 19, Node 22 (`tsx`) · **Date:** 2026-11-26

ES2025 put `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `find`, `some`, `every` and `toArray` on every iterator, and added real set algebra (`union`, `intersection`, `difference`, `isSubsetOf`, …) to `Set`. Both are in all current browsers and in Node 22. The iterator helpers look like array methods, but they are lazy: a value goes through the whole pipeline before the next one is read, and `take(n)` stops the source. The Set methods turn the usual multi-select bookkeeping (select all shown, keep hidden rows selected, diff two selections) into one call each. These examples measure the difference, collect the gotchas I hit, and end with a React list that uses both.

## Key points

- **`01-lazy-vs-eager.ts`**: the same filter → map → first 5 over 50k products. The array chain runs the predicate 50,000 times and formats 5,836 rows; the iterator chain runs it 45 times and formats 5. Also shows the per-item evaluation order and an infinite `range()` that is safe because `take` ends it.
- **`02-paging-and-chunks.ts`**: `drop(n * size).take(size)` for pages, the counter argument in `map((x, i) => …)`, `Map#entries()` and `String#matchAll()` piped directly, `flatMap` for section → row lists, a `chunk()` generator for batching API ids, and `Iterator.from` wrapping a plain `{ next() }` object.
- **`03-gotchas.ts`**: iterators are single-use; `take` calls `return()` on the source so its `finally` runs and it can't be resumed; `flatMap` throws on strings; string iterators walk code points (use `Intl.Segmenter`, see 007); `take(-1)` throws a `RangeError`; there are no async helpers yet, so two small async generators plus `Array.fromAsync` cover paginated fetches lazily.
- **`04-selection-sets.ts`** + **`_selection.ts`**: header checkbox state (`none` / `some` / `all`) from `isDisjointFrom` and `isSubsetOf`, "select all shown" that leaves filtered-out rows alone, shift-click ranges, added/removed diffs for an undo toast, and `intersection` with a `Map` as the set-like argument.
- **`05-show-more.tsx`**: a filterable "show more" list with a select-all checkbox. State holds plain values (query, limit, a `ReadonlySet` of ids) and the pipeline is rebuilt each render with `take(limit + 1)` to know if there is more. Native checkboxes with `indeterminate` set through a ref, a `role="status"` line that reports selected rows hidden by the filter, and focus moved to the first new row after "Show more".
- **`_iter.ts`**: `range`, `chunk`, `uniqueBy` and a call counter, all generators so they compose with the built-in helpers.

## What I practiced

- **Lazy evaluation changes how much work "the same chain" does.** I used to reach for `slice` after `filter().map()` and assume it was fine. Counting the callbacks showed the array version doing ~1000× more predicate calls for a "first 5" view, and `.values()` in front was the whole fix.
- **Keep sources in state, not iterators.** An iterator is a cursor with hidden state, which is the opposite of what React wants. Storing the iterator in a ref skips pages under StrictMode; storing `limit` and rebuilding the pipeline is both correct and cheap because `take` stops early.
- **Selection is set algebra.** Writing the header checkbox as `visible.isSubsetOf(selected)` and the toggle as `union`/`difference` fixed a bug I've shipped before: "unselect all" clearing rows the filter was hiding.

## Run

```bash
npm install
npm run examples   # runs 01–05 with tsx; each file prints what it demonstrates
npm run typecheck  # strict tsc, lib ESNext for the iterator and Set types
```

Expected output is written under each `console.log` as `// →` comments (Node 22). Iterator helpers need Node 22+, Chrome 122+, Firefox 131+ or Safari 18.4+; Set methods need Node 22+, Chrome 122+, Firefox 127+ or Safari 17+.
