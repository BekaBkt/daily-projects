# 012 · Fuzzy Finder Scoring

**Type:** Algorithm · **Stack:** TypeScript (strict), Vitest · **Date:** 2026-11-11

Command palettes and quick-open dialogs let you type `gcp` and get `getCurrentPosition`, or `scb` and get `src/components/Button.tsx`. Checking that the query is a subsequence is easy; the hard part is that there are usually many ways to place it, and the one you highlight (and rank by) should be the one a person meant: letters on word starts and camelCase humps, in runs, with short gaps. `fuzzyMatch` scores every alignment with fzf-style bonuses and affine gap penalties and finds the best one with a dynamic program in O(n·m), returning the score and the matched indices. `fuzzyFilter` ranks a list with it, and `highlight` turns the indices into segments for `<mark>`.

## Key points

- **The scoring model.** Every matched char is worth 16. A match at the start or after a delimiter (`/`, `_`, `-`, space, `.`) gets +8, a camelCase hump or letter→digit step +7, and the first query char's bonus counts double. A match right after the previous one gets at least +4. A gap costs 3 to open and 1 per extra skipped char. Leading characters are free, so `Button` is not punished for living deep in a path.
- **Why greedy is wrong.** Taking the leftmost occurrence of each letter fails on `ab` vs `axxxxxxx_ab`: the leading `a` drags in a 9-char gap, while `_ab` is a boundary followed by a consecutive match. The test checks the DP picks `[9, 10]`.
- **The DP.** `best[i][j]` is the best score with query char `i` placed on target char `j`. It comes either from `best[i-1][j-1]` (consecutive) or from any earlier `k` minus the gap penalty. That max over `k` would make the DP cubic; because the gap cost is affine, it is a running value: each step subtract the extension cost, and fold in `best[i-1][j-2]` minus the open cost. Ties prefer the consecutive path.
- **Pruning with two greedy scans.** A forward scan gives the earliest column each query char can take (and rejects non-matches in O(m)); a backward scan gives the latest. The DP only visits that band, which is narrow for typical queries.
- **Backtracking without a pointer matrix.** Only a 1-byte "came from the diagonal" flag is stored. For gap steps the predecessor is found by looking for the `k` whose score explains the current cell; scores are small integers, so exact equality is safe.
- **Smart case and stable indices.** The match is case-insensitive unless the query has a capital. Case folding is done per UTF-16 unit, because `"İ".toLowerCase()` is two units and a whole-string lowercase would shift every highlight after it.
- **Tests.** Boundary, camelCase, path, smart-case and Unicode cases; ranking ties; highlight runs; and 2,000 seeded random query/target pairs over a nasty alphabet (`aAbB_ 1/`) where a brute-force search over every alignment must agree with the DP's score exactly, and the returned positions must re-score to that same number.

## Complexity

n = query length, m = target length.

| Operation | Time | Space |
| --- | --- | --- |
| Subsequence check (reject) | O(m) | O(n) |
| `fuzzyMatch` | O(n·m), less inside the lo/hi band | O(n·m) |
| Backtrack | O(n·m) worst case | O(n) |
| `fuzzyFilter` over k items | O(k·n·m + k log k) | O(k) results |
| `highlight` | O(m) | O(m) |

A 20-char query against a 1,100-char target takes about 0.2 ms in Node, so filtering a few thousand file paths per keystroke is fine without a worker.

## What I practiced

- **Turning "what looks right" into a scoring function first.** Once bonuses and gaps were numbers, "best highlight" became a well-defined maximization, and `scoreAlignment` gave me a single source of truth for both the DP and the tests.
- **Affine gaps with a running max.** The obvious inner `max over k` loop makes the DP O(n·m²); keeping one running value with an open/extend recurrence (the same trick as Gotoh's sequence alignment) brings it back to O(n·m).
- **Oracle testing again.** The off-by-one risks here (the gap length at `k = j - 2`, where each row's band starts) only show up on specific inputs, so I check the DP against a brute-force enumerator on thousands of seeded cases instead of trusting hand-picked examples.

## How to run

```bash
npm install
npm test           # vitest run
npm run typecheck  # strict tsc over solution and tests
```

```ts
import { fuzzyFilter, highlight } from "./solution";

const hits = fuzzyFilter("scb", paths, (p) => p, { limit: 20 });
hits.map((h) => highlight(h.item, h.positions)); // [{ text: "s", match: true }, …]
```
