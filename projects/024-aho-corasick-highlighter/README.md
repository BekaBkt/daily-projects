# 024 · Multi-Term Highlighter

**Type:** Algorithm · **Stack:** TypeScript (strict), Vitest · **Date:** 2026-11-27

Search UIs highlight query terms in results, docs and logs. The usual approach is one RegExp per term or a big `a|b|c` alternation: that rescans the text for every term, needs escaping, and never reports overlapping matches. This project builds an Aho–Corasick automaton that finds every occurrence of every term in a single left-to-right pass, matches case- and accent-insensitively like find-in-page, and maps each hit back to exact UTF-16 offsets in the original string. `highlight` turns those hits into plain and highlighted segments, ready to render as `<mark>`s.

```
terms:  key · board · yboa
text:   Keyboard shortcuts
result: [Keyboard] shortcuts     one segment, terms [0, 1, 2]
```

## Key points

- **Trie + failure links.** Patterns go into a trie. A breadth-first pass gives every node a failure link to its longest proper suffix that is also a trie path, so on a mismatch the scan falls back instead of restarting. The text pointer never moves backwards.
- **Dictionary links for overlaps.** Each node also points to the nearest suffix that ends a pattern. At each position I yield the current node's patterns and then follow dictionary links, so `ushers` reports `she`, `he` and `hers` without walking fail chains that end in nothing.
- **Folding with an offset map.** The text is folded one code point at a time (`toLowerCase`, then NFD with combining marks removed when `ignoreAccents` is on). `İ` turns into two units, a combining accent turns into zero, so every folded unit records where its source code point starts and ends. A dropped mark stretches the previous character, so a hit on `e` in `é` covers the accent too.
- **Per code point, on purpose.** Lowercasing a whole string is context-sensitive (`Σ` becomes `ς` at the end of a word). Folding text and patterns with the same per-code-point function keeps both sides consistent and the offsets mappable.
- **Segments.** Overlapping hits merge into one segment that lists every term involved; touching hits stay separate. `wholeWord` rejects hits with a letter, digit, mark or `_` right next to them, reading the neighbour as a full code point, so `𝒜cat` doesn't count as a whole-word `cat`.
- **Tests.** The textbook `he/she/his/hers` case, nested and duplicate patterns, astral characters, Turkish `İ`, precomposed vs decomposed accents, Cyrillic word boundaries, 2,000 seeded random cases compared against brute force, and a property check that the segments always cover the source exactly.

## Complexity

n = text length, m = total length of all terms, z = number of matches.

| Step | Time | Space |
| --- | --- | --- |
| Build automaton | O(m) | O(m) |
| `matchAll` | O(n + z) | O(n) for the folded copy |
| `highlight` | O(n + z log z) | O(n + z) |

The fail-link walk in `matchAll` is amortised: every fallback lowers the depth, and depth only grows by one per character. Highlighting 1,000 terms in 1.2 MB of text (400,000 segments) takes about 350 ms in Node, folding and sorting included.

## What I practiced

- **Amortised analysis I could actually use.** The inner `while` that follows failure links looks quadratic. Counting depth as a potential (up by at most one per character, down by at least one per fallback) showed why it isn't, and that the same argument covers building the links breadth-first.
- **Keeping two coordinate systems straight.** Matching happens on folded text, rendering on the original. Storing a start and end offset per folded unit was simpler and less fragile than trying to undo the folding afterwards, and it made `İstanbul` and decomposed accents just work.
- **Brute force as the spec again.** Comparing against `startsWith` at every offset on tiny alphabets found the cases I'd miss by hand: patterns that are suffixes of other patterns, duplicates, and matches that end on the same character.

## How to run

```bash
npm install
npm test           # vitest run
npm run typecheck  # strict tsc over solution and tests
```

```tsx
import { highlight } from "./solution";

function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query.split(/\s+/).filter(Boolean);
  return (
    <>
      {highlight(text, terms, { ignoreAccents: true }).map((s) =>
        s.terms.length ? <mark key={s.start}>{s.text}</mark> : s.text,
      )}
    </>
  );
}
```
