# 016 · Calendar Event Layout

**Type:** Algorithm · **Stack:** TypeScript (strict), Vitest · **Date:** 2026-11-16

Every day view in a calendar app has to answer the same question: three meetings overlap at 9:30, so how wide is each one and where does it go? Doing it badly gives you either overlapping boxes or every event squeezed to a sliver because something unrelated at 4 pm was busy. `layoutEvents` splits the day into overlap clusters, packs each cluster into the minimum number of columns with a sweep over start times and two heaps, and then lets each event stretch right across columns that stay empty for its whole duration. It returns `column`, `span` and `columns` per event, and `toBox` turns that into `top/height` pixels and `left/width` percentages for absolute positioning.

## Key points

- **Half-open intervals.** An event is `[start, end)`, so 10:00–11:00 and 11:00–12:00 touch but do not overlap and both stay full width. Zero-length events are rejected unless you pass `minDuration`, which also makes a 5-minute event behave as tall as it is drawn, so nothing gets painted over it.
- **Clusters, not the whole day.** Widths are shared only inside a cluster: a chain of events where each overlaps the next. `a` and `c` can share a cluster without touching, as long as `b` links them. Sorted by start, a new cluster starts exactly when no event is still running, so detecting it costs nothing extra.
- **Column packing with two heaps.** A `busy` min-heap keyed by end time holds running events, and a `free` min-heap holds column indices that opened up. At each start: move everything that ended into `free`, take the lowest free column or open a new one. Taking events in start order (longer first on ties) is first-fit colouring of an interval graph, which uses exactly as many columns as the busiest moment needs.
- **Expanding right.** Within a column, events are disjoint and were added in start order, so their ends are sorted too. "Is column `j` empty during `[s, e)`?" becomes a binary search for the first event in `j` ending after `s` and a check that it starts before `e`.
- **Stable output.** Results come back in input order, and ties are broken by input index, so re-rendering the same data never makes events swap places.
- **Tests.** Hand-written cases (back-to-back, chains, freed columns, expansion, `minDuration`, bad input), then 3,000 seeded random days compared field by field against a brute-force version built from union-find clusters and a naive "lowest column with no overlap" loop. Property checks confirm overlapping events never share horizontal space and every cluster's column count equals its peak concurrency.

## Complexity

n = events, k = columns in a cluster.

| Step | Time | Space |
| --- | --- | --- |
| Sort | O(n log n) | O(n) |
| Cluster + column sweep | O(n log n) | O(n) |
| Expansion | O(n · k · log n) worst case, usually a step or two per event | O(n) |
| `toBox` | O(1) | O(1) |

For a real day k is small, so the whole thing is effectively O(n log n). A random week of 10,000 heavily overlapping events lays out in about 12 ms in Node.

## What I practiced

- **Seeing the interval graph under the UI.** Once I framed columns as colouring an interval graph, it was clear why greedy by start time is optimal and why the width should depend on the cluster, not the whole day.
- **The two-heap sweep.** One heap for "who ends next", one for "lowest free slot". It is the same pattern as meeting-room scheduling, plus the detail that the lowest free index is what keeps the layout tidy.
- **Using sortedness I already had.** Expansion looked like it needed an interval tree, but columns are already sorted by both start and end, so a binary search was enough. Flipping a single `<=` to `<` on touching events makes the brute-force comparison fail right away, which is exactly the class of bug I wanted it to catch.

## How to run

```bash
npm install
npm test           # vitest run
npm run typecheck  # strict tsc over solution and tests
```

```ts
import { layoutEvents, toBox } from "./solution";

const placed = layoutEvents(events, { minDuration: 15 });
placed.map((p) => toBox(p, { dayStart: 8 * 60, pxPerMinute: 1.2 }));
// { top, height } in px, { left, width } in % of the day column
```
