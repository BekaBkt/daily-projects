/**
 * Fuzzy matching for command palettes and quick-open lists.
 *
 * The query must appear in the target as a subsequence. Among all the ways
 * it can be aligned, we pick the one with the highest score: matches on word
 * boundaries and camelCase humps earn bonuses, consecutive matches earn a
 * bonus, and gaps between matches cost an affine penalty. A small dynamic
 * program finds that best alignment in O(n·m) instead of trying them all.
 *
 * Positions are UTF-16 code unit indices, so they can be fed straight into
 * `String.prototype.slice` for highlighting.
 */

export const SCORE = {
  /** Every matched character. */
  match: 16,
  /** Cost of opening a gap between two matched characters. */
  gapStart: 3,
  /** Cost of each further skipped character in the same gap. */
  gapExtension: 1,
  /** Match right after a delimiter (or at the very start). */
  boundary: 8,
  /** Match on a camelCase hump (`gC` in `getCurrent`) or a letter→digit step. */
  camel: 7,
  /** Minimum bonus for a match directly after the previous one. */
  consecutive: 4,
  /** The first query character's position bonus counts this many times. */
  firstCharMultiplier: 2,
} as const;

export interface FuzzyMatch {
  score: number;
  /** Ascending target indices, one per query character. */
  positions: number[];
}

export interface MatchOptions {
  /** Default is smart case: case-sensitive only if the query has an uppercase letter. */
  caseSensitive?: boolean;
}

const enum CharClass {
  Delimiter,
  Lower,
  Upper,
  Digit,
  Letter,
}

const LOWER = /\p{Ll}/u;
const UPPER = /\p{Lu}/u;
const DIGIT = /\p{Nd}/u;
const LETTER = /\p{L}/u;

function classOf(ch: string): CharClass {
  if (LOWER.test(ch)) return CharClass.Lower;
  if (UPPER.test(ch)) return CharClass.Upper;
  if (DIGIT.test(ch)) return CharClass.Digit;
  if (LETTER.test(ch)) return CharClass.Letter; // uncased scripts, e.g. CJK
  return CharClass.Delimiter;
}

function bonusFor(prev: CharClass, cur: CharClass): number {
  if (cur === CharClass.Delimiter) return 0;
  if (prev === CharClass.Delimiter) return SCORE.boundary;
  if (prev === CharClass.Lower && cur === CharClass.Upper) return SCORE.camel;
  if (prev !== CharClass.Digit && cur === CharClass.Digit) return SCORE.camel;
  return 0;
}

/** Position bonus for matching each character of `target`. */
export function positionBonuses(target: string): Int8Array {
  const bonuses = new Int8Array(target.length);
  let prev = CharClass.Delimiter; // the start of the string acts like a boundary
  for (let j = 0; j < target.length; j++) {
    const cur = classOf(target[j]!);
    bonuses[j] = bonusFor(prev, cur);
    prev = cur;
  }
  return bonuses;
}

function gapPenalty(skipped: number): number {
  return skipped === 0 ? 0 : SCORE.gapStart + (skipped - 1) * SCORE.gapExtension;
}

/**
 * Score of one specific alignment. `fuzzyMatch` returns the alignment that
 * maximizes this; it is exported so the tests can check that claim.
 */
export function scoreAlignment(target: string, positions: readonly number[]): number {
  const bonuses = positionBonuses(target);
  let score = 0;
  for (let i = 0; i < positions.length; i++) {
    const j = positions[i]!;
    const bonus = bonuses[j]!;
    score += SCORE.match;
    if (i === 0) {
      score += bonus * SCORE.firstCharMultiplier;
      continue;
    }
    const skipped = j - positions[i - 1]! - 1;
    score += skipped === 0 ? Math.max(bonus, SCORE.consecutive) : bonus - gapPenalty(skipped);
  }
  return score;
}

/** Fold case one code unit at a time so indices never shift (`İ` lowercases to two units). */
function foldUnits(s: string, caseSensitive: boolean): string[] {
  const units = Array.from({ length: s.length }, (_, i) => s[i]!);
  if (caseSensitive) return units;
  return units.map((c) => {
    const lower = c.toLowerCase();
    return lower.length === 1 ? lower : c;
  });
}

export function fuzzyMatch(
  query: string,
  target: string,
  options: MatchOptions = {},
): FuzzyMatch | null {
  const n = query.length;
  const m = target.length;
  if (n === 0) return { score: 0, positions: [] };
  if (n > m) return null;

  const caseSensitive = options.caseSensitive ?? query !== query.toLowerCase();
  const q = foldUnits(query, caseSensitive);
  const t = foldUnits(target, caseSensitive);

  // Greedy scans from both ends give, for each query char, the earliest and
  // latest column it can occupy in any valid alignment. If the forward scan
  // fails there is no match at all; otherwise the DP only visits [lo, hi].
  const lo = new Int32Array(n);
  const hi = new Int32Array(n);
  for (let i = 0, j = 0; i < n; i++, j++) {
    while (j < m && t[j] !== q[i]) j++;
    if (j === m) return null;
    lo[i] = j;
  }
  for (let i = n - 1, j = m - 1; i >= 0; i--, j--) {
    while (t[j] !== q[i]) j--;
    hi[i] = j;
  }

  const bonuses = positionBonuses(target);
  // best[i*m + j]: best score of query[0..i] with query[i] matched at target[j].
  const best = new Float64Array(n * m).fill(-Infinity);
  // Whether that best score came from a match at j - 1 (used to backtrack).
  const fromDiagonal = new Uint8Array(n * m);

  for (let j = lo[0]!; j <= hi[0]!; j++) {
    if (t[j] === q[0]) best[j] = SCORE.match + bonuses[j]! * SCORE.firstCharMultiplier;
  }

  for (let i = 1; i < n; i++) {
    const row = i * m;
    const prev = row - m;
    // max over k <= j - 2 of best[prev + k] - gapPenalty(j - k - 1), kept as a
    // running value: every step one more character is skipped (extension), and
    // k = j - 2 joins as a fresh one-character gap (start).
    let gapBest = -Infinity;
    for (let j = lo[i - 1]! + 1; j <= hi[i]!; j++) {
      if (j >= 2) gapBest = Math.max(gapBest - SCORE.gapExtension, best[prev + j - 2]! - SCORE.gapStart);
      if (j < lo[i]! || t[j] !== q[i]) continue;

      const bonus = bonuses[j]!;
      const viaDiagonal = best[prev + j - 1]! + SCORE.match + Math.max(bonus, SCORE.consecutive);
      const viaGap = gapBest + SCORE.match + bonus;
      if (viaDiagonal >= viaGap) {
        best[row + j] = viaDiagonal;
        fromDiagonal[row + j] = 1;
      } else {
        best[row + j] = viaGap;
      }
    }
  }

  const last = (n - 1) * m;
  let end = -1;
  let score = -Infinity;
  for (let j = lo[n - 1]!; j <= hi[n - 1]!; j++) {
    if (best[last + j]! > score) {
      score = best[last + j]!;
      end = j;
    }
  }

  // Walk back. A diagonal step is recorded; for a gap step we look for the
  // predecessor whose score explains this cell (scores are exact integers).
  const positions = new Array<number>(n);
  positions[n - 1] = end;
  for (let i = n - 1, j = end; i > 0; i--) {
    if (fromDiagonal[i * m + j]) {
      j -= 1;
    } else {
      const needed = best[i * m + j]! - SCORE.match - bonuses[j]!;
      let k = j - 2;
      while (best[(i - 1) * m + k]! - gapPenalty(j - k - 1) !== needed) k--;
      j = k;
    }
    positions[i - 1] = j;
  }

  return { score, positions };
}

export interface Ranked<T> {
  item: T;
  score: number;
  positions: number[];
}

export interface FilterOptions extends MatchOptions {
  limit?: number;
}

/**
 * Match every item and rank the hits: higher score first, then the shorter
 * text (a tighter fit), then the original order so the sort is stable.
 */
export function fuzzyFilter<T>(
  query: string,
  items: readonly T[],
  getText: (item: T) => string,
  options: FilterOptions = {},
): Ranked<T>[] {
  const hits: { ranked: Ranked<T>; length: number; index: number }[] = [];
  items.forEach((item, index) => {
    const text = getText(item);
    const match = fuzzyMatch(query, text, options);
    if (match) hits.push({ ranked: { item, ...match }, length: text.length, index });
  });
  hits.sort(
    (a, b) => b.ranked.score - a.ranked.score || a.length - b.length || a.index - b.index,
  );
  const ranked = hits.map((h) => h.ranked);
  return options.limit === undefined ? ranked : ranked.slice(0, options.limit);
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Split `text` into runs of matched / unmatched characters for rendering `<mark>`s. */
export function highlight(text: string, positions: readonly number[]): Segment[] {
  const marked = new Set(positions);
  const segments: Segment[] = [];
  let start = 0;
  for (let j = 1; j <= text.length; j++) {
    if (j === text.length || marked.has(j) !== marked.has(start)) {
      segments.push({ text: text.slice(start, j), match: marked.has(start) });
      start = j;
    }
  }
  return segments;
}
