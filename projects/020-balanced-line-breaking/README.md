# 020 · Balanced Line Breaking

**Type:** Algorithm · **Stack:** TypeScript (strict), Vitest · **Date:** 2026-11-21

CSS now has `text-wrap: pretty` and `text-wrap: balance`, but I wanted to know what they actually compute, and I needed the same behaviour for canvas labels and SVG charts, where the browser does not wrap anything for me. This project implements the three strategies on plain word widths: `wrapGreedy` (the default browser behaviour), `wrapPretty` (minimum raggedness with an orphan penalty, a stripped-down Knuth–Plass) and `wrapBalanced` (same line count as greedy, lines as even as possible). `wrapText` wraps a string with any `measure` function, such as `ctx.measureText(word).width`.

```
greedy               pretty / balance
Keyboard focus       Keyboard focus
should always be     should always
visible on every     be visible on
control              every control
```

## Key points

- **Greedy is optimal for one thing.** Filling each line as far as it goes always gives the fewest lines, which is why it is the default and why `balance` starts from its line count.
- **Pretty is a shortest path.** `best[j] = min over i of best[i] + cost(i..j)`, where a line costs its squared empty space and the last line is free unless it holds a single word (the orphan penalty, by default the cost of a half-empty line). Squaring the slack is what makes two half-full lines cheaper than one full and one nearly empty.
- **Stopping early.** Widths are non-negative, so once words `i..j` overflow, every longer line does too. The inner loop breaks there, which makes the DP O(n · L) instead of O(n²), where L is the number of words that fit on a line.
- **Balance is a bisection.** Greedy's line count can only fall as the width grows, so I bisect for the narrowest width that still needs k lines and run greedy at that width. Its longest line is the shortest any k-line layout can have.
- **Real-world edges.** A word wider than `maxWidth` gets its own overflowing line, like CSS without `overflow-wrap`. Comparisons allow for float drift, so `0.1 + 0.2` fits in `0.3`. Bad widths throw a `RangeError` with the word index.
- **Tests.** Hand-written cases (headline balancing, orphan avoidance, overlong words, empty input, validation), then 1,500 seeded random paragraphs of up to 11 words checked against brute force over all 2ⁿ⁻¹ ways to break them: greedy has the minimum line count, pretty has the minimum cost and balance has the minimum longest line for its line count.

## Complexity

n = words, L = most words that fit on one line, W = `maxWidth`.

| Function | Time | Space |
| --- | --- | --- |
| `wrapGreedy` | O(n) | O(n) |
| `wrapPretty` | O(n · L) | O(n) |
| `wrapBalanced` | O(n · log(W / ε)), about 30 greedy passes | O(n) |

20,000 words of pixel widths wrap in about 9 ms for each of `pretty` and `balance` in Node.

## What I practiced

- **Turning a layout rule into a cost function.** Once "looks nicer" became "sum of squared slack plus an orphan penalty", it was an ordinary DP over break points, and the tie-break (`<=` to prefer the longest line ending at j) became an explicit decision instead of an accident.
- **Bisection on the answer.** I almost wrote a separate DP for "minimise the longest line in k lines". Noticing that greedy's line count is monotonic in the width made it a binary search over a function I already had.
- **Brute force as the spec.** Enumerating every break pattern for small inputs is slow but obviously correct, so it pins down the edge cases I care about: putting the overflow `break` before the single-word check, for example, drops overlong words and fails the comparison straight away.

## How to run

```bash
npm install
npm test           # vitest run
npm run typecheck  # strict tsc over solution and tests
```

```ts
import { wrapText } from "./solution";

const ctx = canvas.getContext("2d")!;
ctx.font = "600 20px Inter";
const lines = wrapText(title, (w) => ctx.measureText(w).width, {
  maxWidth: 280,
  mode: "balance",
});
lines.forEach((line, i) => ctx.fillText(line, 0, 28 * (i + 1)));
```
