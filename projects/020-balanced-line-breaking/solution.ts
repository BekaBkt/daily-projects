/**
 * Line breaking for UI text: the three strategies behind CSS
 * `text-wrap: wrap`, `text-wrap: pretty` and `text-wrap: balance`.
 *
 * Everything works on word widths (pixels, characters, any unit), so the
 * same code can run against `canvas.measureText`, a font metrics table or
 * plain string length in tests. Words are never split: a word wider than
 * `maxWidth` gets a line of its own and overflows, like it does in CSS.
 */

export interface Line {
  /** Index of the first word on the line. */
  start: number;
  /** Index one past the last word on the line. */
  end: number;
  /** Words plus the spaces between them. */
  width: number;
}

export interface WrapOptions {
  maxWidth: number;
  /** Width of the gap between two words. Defaults to 0. */
  spaceWidth?: number;
}

export interface PrettyOptions extends WrapOptions {
  /**
   * Cost of ending the paragraph with a single word on its own line.
   * Defaults to the cost of a half-empty line, `(maxWidth / 2) ** 2`.
   * Pass 0 to only minimise raggedness.
   */
  orphanPenalty?: number;
}

export type WrapMode = "greedy" | "pretty" | "balance";

/** Float sums drift; never reject a line for being 1e-12 too wide. */
function fits(width: number, maxWidth: number): boolean {
  return width <= maxWidth + 1e-9 * Math.max(1, maxWidth);
}

function validate(widths: readonly number[], opts: WrapOptions): number {
  const { maxWidth, spaceWidth = 0 } = opts;
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    throw new RangeError(`maxWidth must be a positive number, got ${maxWidth}`);
  }
  if (!Number.isFinite(spaceWidth) || spaceWidth < 0) {
    throw new RangeError(`spaceWidth must be a non-negative number, got ${spaceWidth}`);
  }
  widths.forEach((w, i) => {
    if (!Number.isFinite(w) || w < 0) {
      throw new RangeError(`word ${i} has invalid width ${w}`);
    }
  });
  return spaceWidth;
}

/** prefix[i] = sum of the first i widths, so a line is O(1) to measure. */
function prefixSums(widths: readonly number[]): Float64Array {
  const prefix = new Float64Array(widths.length + 1);
  widths.forEach((w, i) => {
    prefix[i + 1] = prefix[i]! + w;
  });
  return prefix;
}

function measureLine(prefix: Float64Array, space: number, start: number, end: number): number {
  return prefix[end]! - prefix[start]! + space * (end - start - 1);
}

/**
 * First fit: put as many words on each line as will go. This is what
 * browsers do by default, and it always uses the fewest lines possible.
 */
export function wrapGreedy(widths: readonly number[], opts: WrapOptions): Line[] {
  const space = validate(widths, opts);
  return greedy(widths, opts.maxWidth, space);
}

function greedy(widths: readonly number[], maxWidth: number, space: number): Line[] {
  const lines: Line[] = [];
  if (widths.length === 0) return lines;

  let start = 0;
  let width = widths[0]!;
  for (let k = 1; k < widths.length; k++) {
    const next = width + space + widths[k]!;
    if (fits(next, maxWidth)) {
      width = next;
    } else {
      lines.push({ start, end: k, width });
      start = k;
      width = widths[k]!;
    }
  }
  lines.push({ start, end: widths.length, width });
  return lines;
}

/**
 * Minimum raggedness (the Knuth–Plass idea without hyphenation or
 * stretchable glue): choose breaks that minimise the sum of squared empty
 * space on every line except the last, plus a penalty for a lone last word.
 *
 * best[j] = min over i of best[i] + cost(words i..j-1 as one line)
 *
 * Widths are non-negative, so once words i..j-1 overflow, every earlier i
 * overflows too and the inner loop can stop. That makes it O(n · L), where
 * L is the most words that fit on one line.
 */
export function wrapPretty(widths: readonly number[], opts: PrettyOptions): Line[] {
  const space = validate(widths, opts);
  const { maxWidth } = opts;
  const orphanPenalty = opts.orphanPenalty ?? (maxWidth / 2) ** 2;
  if (!Number.isFinite(orphanPenalty) || orphanPenalty < 0) {
    throw new RangeError(`orphanPenalty must be a non-negative number, got ${orphanPenalty}`);
  }

  const n = widths.length;
  if (n === 0) return [];

  const prefix = prefixSums(widths);
  const best = new Float64Array(n + 1).fill(Infinity);
  const from = new Int32Array(n + 1);
  best[0] = 0;

  for (let j = 1; j <= n; j++) {
    // Walk i backwards so the line grows one word at a time.
    for (let i = j - 1; i >= 0; i--) {
      const width = measureLine(prefix, space, i, j);
      const single = j - i === 1;
      if (!single && !fits(width, maxWidth)) break;

      let cost: number;
      if (j === n) {
        cost = single && n > 1 ? orphanPenalty : 0;
      } else {
        // An overflowing single word has no better option, so it is free.
        cost = fits(width, maxWidth) ? (maxWidth - width) ** 2 : 0;
      }

      const total = best[i]! + cost;
      // `<=` keeps the smallest i on ties: the longest line ending at j.
      if (total <= best[j]!) {
        best[j] = total;
        from[j] = i;
      }
    }
  }

  const lines: Line[] = [];
  for (let j = n; j > 0; j = from[j]!) {
    const i = from[j]!;
    lines.push({ start: i, end: j, width: measureLine(prefix, space, i, j) });
  }
  return lines.reverse();
}

/**
 * Keep the greedy line count, but make the lines as even as possible: find
 * the narrowest width at which greedy still needs only that many lines.
 *
 * Greedy's line count only goes down as the width grows, so the narrowest
 * such width can be found by bisection, and greedy at that width is a
 * layout whose longest line is as short as it can be with k lines.
 */
export function wrapBalanced(widths: readonly number[], opts: WrapOptions): Line[] {
  const space = validate(widths, opts);
  const { maxWidth } = opts;
  const target = greedy(widths, maxWidth, space);
  const k = target.length;
  if (k <= 1) return target;

  const n = widths.length;
  const total = widths.reduce((a, b) => a + b, 0) + space * (n - k);
  // No layout in k lines can beat an even split or the widest word.
  let lo = Math.min(maxWidth, Math.max(widths.reduce((a, b) => Math.max(a, b), 0), total / k));
  let hi = maxWidth;
  if (greedy(widths, lo, space).length <= k) return greedy(widths, lo, space);

  // Invariant: greedy(lo) needs more than k lines, greedy(hi) needs exactly k.
  while (hi - lo > 1e-9 * Math.max(1, maxWidth)) {
    const mid = (lo + hi) / 2;
    if (greedy(widths, mid, space).length <= k) hi = mid;
    else lo = mid;
  }
  return greedy(widths, hi, space);
}

/** Sum of squared empty space on every line but the last. Lower is smoother. */
export function raggedness(lines: readonly Line[], maxWidth: number): number {
  let sum = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    sum += Math.max(0, maxWidth - lines[i]!.width) ** 2;
  }
  return sum;
}

/**
 * Convenience wrapper for real text: split on whitespace, measure each word
 * once, wrap, and join the words back into line strings.
 */
export function wrapText(
  text: string,
  measure: (word: string) => number,
  opts: PrettyOptions & { mode?: WrapMode },
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const widths = words.map(measure);
  const resolved = { ...opts, spaceWidth: opts.spaceWidth ?? measure(" ") };

  const mode = opts.mode ?? "pretty";
  const lines =
    mode === "greedy"
      ? wrapGreedy(widths, resolved)
      : mode === "balance"
        ? wrapBalanced(widths, resolved)
        : wrapPretty(widths, resolved);

  return lines.map((line) => words.slice(line.start, line.end).join(" "));
}
