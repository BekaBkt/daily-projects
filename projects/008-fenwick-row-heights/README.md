# 008 · Fenwick Tree for Virtual Lists

**Type:** Algorithm · **Stack:** TypeScript (strict), Vitest · **Date:** 2026-11-07

A virtualized list (chat history, feeds, log viewers, big tables) renders only the rows in the viewport, so on every scroll frame it needs "which row is at `scrollTop`?" and "where does row `i` start?". With fixed row heights that is just division. With real content, rows start from an estimate and get their true height after `ResizeObserver` measures them, so the offsets keep shifting. `RowHeights` stores those heights in a Fenwick (binary indexed) tree, so a measurement, an offset lookup and a scroll-position lookup are all O(log n), and it adds the helpers a list component actually calls: `visibleRange` with overscan, `scrollTopFor` for scroll-to-index, and `resize` for infinite loading.

## Key points

- **The trade-off it removes.** A prefix-sum array answers `offsetOf(i)` in O(1) but every measured row means rewriting all sums after it, O(n). Recomputing sums on demand flips that. Measurements and lookups happen together while scrolling, so both need to be cheap.
- **How the tree works.** `tree[i]` (1-based) holds the sum of the `lowbit(i)` heights ending at row `i`, where `lowbit(i) = i & -i`. A prefix sum walks `i -= lowbit(i)`; an update walks `i += lowbit(i)`. Both touch at most ⌈log₂ n⌉ nodes.
- **Linear build.** Instead of n separate updates, each node adds its partial sum to its parent `i + lowbit(i)` once, so 100,000 estimated rows are set up in O(n).
- **Position to index by binary lifting.** `indexAt(y)` walks powers of two from the top and takes every jump whose block still fits in the remaining offset. That is a single O(log n) descent, not a binary search over `offsetOf` at O(log² n).
- **Boundaries.** A row owns `[top, bottom)`, so an offset on a boundary belongs to the row below and zero-height (collapsed) rows are skipped. `visibleRange` drops a row that starts exactly at the viewport's bottom edge, then adds overscan on both sides.
- **Scroll anchoring.** `set` returns the height delta. When the measured row is above the viewport, the list adds that delta to `scrollTop` so the visible content does not jump.
- **Tests.** Boundary and clamping cases, zero-height rows, non-power-of-two sizes, `scrollTopFor` for every alignment, `resize`, and 50 seeded rounds of 300 random operations checked against a naive O(n) implementation, plus a drift check with fractional heights.

## Complexity

| Operation | Time | Notes |
| --- | --- | --- |
| `new RowHeights(n, estimate)` | O(n) | linear build |
| `get(i)` | O(1) | plain heights array |
| `set(i, h)` | O(log n) | returns the delta |
| `offsetOf(i)`, `total` | O(log n) | prefix sum |
| `indexAt(y)` | O(log n) | binary lifting |
| `visibleRange`, `scrollTopFor` | O(log n) | a few lookups each |
| `resize(n)` | O(n) | rebuild, keeps measured heights |
| Space | O(n) | two `Float64Array`s |

## What I practiced

- **Picking the data structure from the access pattern.** I started from "what does a virtual list ask on every frame?" and the answer (point updates mixed with prefix queries and a reverse lookup) is exactly what a Fenwick tree is good at; a segment tree would work too, with more code and memory.
- **Binary lifting for the reverse query.** Searching the tree directly instead of binary searching over `offsetOf` took `indexAt` from O(log² n) to O(log n). Getting the `<=` right is what makes boundaries and zero-height rows behave.
- **Oracle testing with exact arithmetic.** The random tests use integer heights so Fenwick sums and naive sums must match with `toBe`, not "close enough"; a separate test checks that float drift stays tiny with fractional heights.

## How to run

```bash
npm install
npm test           # vitest run
npm run typecheck  # strict tsc over solution and tests
```
