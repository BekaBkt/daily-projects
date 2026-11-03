# 004 · Myers Line Diff

**Type:** Algorithm · **Stack:** TypeScript (strict), Vitest · **Date:** 2026-11-03

Every diff viewer, code review tool and "unsaved changes" preview needs the same thing: the smallest set of inserted and deleted lines that turns one text into another. This is Eugene Myers' 1986 O(ND) algorithm, the one behind `git diff`, written as a generic `diff(a, b, equals?)` over any array plus a `diffLines` helper for strings. Each edit carries its original `aIndex`/`bIndex`, so a UI can render side-by-side views or line numbers straight from the result.

## Key points

- **The problem.** Find a shortest edit script between `a` (length N) and `b` (length M). Its length D is `N + M − 2·LCS(a, b)`, but the classic LCS table costs O(NM) time and memory, which hurts on two 10,000-line files that differ by three lines.
- **The edit graph.** Put `a` on the x-axis and `b` on the y-axis. Moving right deletes `a[x]`, moving down inserts `b[y]`, and a diagonal is free whenever `a[x] === b[y]`. A shortest edit script is a path from (0, 0) to (N, M) with the fewest non-diagonal moves.
- **Greedy by edit count.** For d = 0, 1, 2, … keep `v[k]`, the furthest x reachable on diagonal `k = x − y` using exactly d edits. Each round takes one step from diagonal k − 1 or k + 1 (whichever got further), then slides down the free "snake" as far as it goes. The first round that reaches (N, M) is the answer, so the work grows with D, not with N·M.
- **Backtracking.** A copy of `v` is saved each round; walking those snapshots from the end recovers which neighbour every step came from, giving the full script. Ties prefer the deletion, so a replaced line prints as `-old` then `+new`, the way unified diffs do.
- **Prefix/suffix trimming.** Common leading and trailing lines are matched before the search starts. In real edits this is usually most of the file, and it is the same trick production diff libraries use first.
- **Tests.** Edge cases (empty sides, identical inputs), the `ABCABBA → CBABAC` example from the paper (D = 5), index correctness, custom equality, and 500 seeded random cases checked against an independent O(NM) LCS oracle and by rebuilding both inputs from the script.

## Complexity

| | Time | Space |
| --- | --- | --- |
| Search | O((N + M) · D) | O(N + M) for `v` |
| Trace for backtracking | | O((N + M) · D) |
| Prefix/suffix trim | O(N + M) | O(1) extra |

With small diffs D is tiny and the whole thing is close to linear. The worst case (completely different inputs, D = N + M) is quadratic, like plain LCS. Myers' linear-space refinement finds the "middle snake" and recurses on both halves to drop the trace to O(N + M) memory; that is the next step if this ever has to diff very large, very different files.

## What I practiced

- **Turning a DP table into a graph search.** Framing diff as "shortest path where diagonals are free" is what makes the O(ND) bound fall out: you explore by number of edits, so cost tracks how different the inputs are, not how big they are.
- **Testing an algorithm against an oracle.** A slow, obviously correct LCS plus a seeded PRNG catches off-by-one mistakes in the diagonal bookkeeping that hand-written cases miss, and stays reproducible when it fails.
- **Typing with `noUncheckedIndexedAccess`.** Array reads are `T | undefined` under this flag; the `!` assertions sit only where the loop bounds already prove the index is valid, and the discriminated `Edit<T>` union makes `aIndex`/`bIndex` exist only on the kinds that have them.

## How to run

```bash
npm install
npm test           # vitest run
npm run typecheck  # strict tsc over solution and tests
```
