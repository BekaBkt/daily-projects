/**
 * Multi-term highlighting with an Aho–Corasick automaton.
 *
 * Search fields usually highlight with one RegExp per term or a big
 * `a|b|c` alternation. Both re-scan the text per term or backtrack, and
 * neither reports overlapping matches. Aho–Corasick finds every occurrence
 * of every term in one left-to-right pass: O(text + total term length +
 * matches), however many terms there are.
 *
 * Matching runs on a folded copy of the text (lowercase, optionally with
 * accents removed) and every match is mapped back to UTF-16 offsets in the
 * original string, so the result can be sliced straight into <mark>s.
 */

export interface FoldOptions {
  /** Compare case-insensitively. Default true. */
  ignoreCase?: boolean;
  /** Treat "é" as "e" and "İ" as "i", like find-in-page. Default false. */
  ignoreAccents?: boolean;
}

export interface Match {
  /** UTF-16 offset in the original text, inclusive. */
  start: number;
  /** UTF-16 offset in the original text, exclusive. */
  end: number;
  /** Index into the patterns passed to the constructor. */
  pattern: number;
}

export interface Folded {
  text: string;
  /** For each unit of `text`, where its code point starts in the source. */
  starts: number[];
  /** For each unit of `text`, where its code point (plus any dropped marks) ends. */
  ends: number[];
}

const MARKS = /\p{M}/gu;

/**
 * Fold one code point at a time. Folding the whole string at once would
 * be context-sensitive ("Σ" lowercases to "ς" at the end of a word) and,
 * worse, could change length in ways I cannot map back to the source.
 */
export function fold(source: string, options: FoldOptions = {}): Folded {
  const { ignoreCase = true, ignoreAccents = false } = options;
  let text = "";
  const starts: number[] = [];
  const ends: number[] = [];

  let i = 0;
  for (const cp of source) {
    const next = i + cp.length;
    let f = ignoreCase ? cp.toLowerCase() : cp;
    if (ignoreAccents) f = f.normalize("NFD").replace(MARKS, "");

    if (f.length === 0) {
      // A dropped combining mark belongs to the character before it, so a
      // highlight of "e" in "é" covers the accent too.
      if (ends.length > 0) ends[ends.length - 1] = next;
    } else {
      text += f;
      for (let k = 0; k < f.length; k++) {
        starts.push(i);
        ends.push(next);
      }
    }
    i = next;
  }
  return { text, starts, ends };
}

interface Node {
  next: Map<number, number>;
  fail: number;
  /** Nearest proper suffix (via fail links) that ends a pattern, or -1. */
  dict: number;
  /** Patterns that end exactly here (duplicates share a node). */
  out: number[];
  depth: number;
}

const ROOT = 0;

export class AhoCorasick {
  readonly patterns: readonly string[];
  readonly options: Readonly<FoldOptions>;
  private readonly nodes: Node[] = [];

  constructor(patterns: readonly string[], options: FoldOptions = {}) {
    this.patterns = patterns;
    this.options = options;
    this.nodes.push(newNode(0));

    patterns.forEach((pattern, index) => {
      const key = fold(pattern, options).text;
      if (key.length === 0) return; // an empty term would match everywhere
      let state = ROOT;
      for (let k = 0; k < key.length; k++) {
        const c = key.charCodeAt(k);
        let child = this.node(state).next.get(c);
        if (child === undefined) {
          child = this.nodes.length;
          this.nodes.push(newNode(this.node(state).depth + 1));
          this.node(state).next.set(c, child);
        }
        state = child;
      }
      this.node(state).out.push(index);
    });

    this.linkFailures();
  }

  /** Number of trie states, root included. */
  get size(): number {
    return this.nodes.length;
  }

  /**
   * Every occurrence of every pattern, overlaps included, ordered by end
   * offset and, for the same end, longest first.
   */
  *matchAll(text: string): Generator<Match> {
    const { text: folded, starts, ends } = fold(text, this.options);
    let state = ROOT;

    for (let k = 0; k < folded.length; k++) {
      state = this.step(state, folded.charCodeAt(k));

      for (let s = state; s !== -1; s = this.node(s).dict) {
        const node = this.node(s);
        if (node.out.length === 0) continue; // only the first hop can be empty
        const start = starts[k + 1 - node.depth]!;
        const end = ends[k]!;
        for (const pattern of node.out) yield { start, end, pattern };
      }
    }
  }

  private step(state: number, c: number): number {
    let s = state;
    for (;;) {
      const to = this.node(s).next.get(c);
      if (to !== undefined) return to;
      if (s === ROOT) return ROOT;
      s = this.node(s).fail;
    }
  }

  /** Breadth-first, so every shorter suffix is linked before it is needed. */
  private linkFailures(): void {
    const queue: number[] = [];
    for (const child of this.node(ROOT).next.values()) queue.push(child);

    for (let head = 0; head < queue.length; head++) {
      const parent = queue[head]!;
      for (const [c, child] of this.node(parent).next) {
        const fail = this.step(this.node(parent).fail, c);
        const node = this.node(child);
        node.fail = fail;
        const f = this.node(fail);
        node.dict = f.out.length > 0 ? fail : f.dict;
        queue.push(child);
      }
    }
  }

  private node(i: number): Node {
    return this.nodes[i]!;
  }
}

function newNode(depth: number): Node {
  return { next: new Map(), fail: ROOT, dict: -1, out: [], depth };
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  /** Indices of the terms covering this segment; empty for plain text. */
  terms: number[];
}

export interface HighlightOptions extends FoldOptions {
  /** Only match terms with no letter, digit or "_" right before or after. */
  wholeWord?: boolean;
}

const WORD = /[\p{L}\p{N}\p{M}_]/u;

function isWordAt(text: string, index: number, before: boolean): boolean {
  if (before) {
    if (index <= 0) return false;
    let i = index - 1;
    const unit = text.charCodeAt(i);
    if (unit >= 0xdc00 && unit <= 0xdfff && i > 0) i--; // low surrogate
    return WORD.test(String.fromCodePoint(text.codePointAt(i)!));
  }
  if (index >= text.length) return false;
  return WORD.test(String.fromCodePoint(text.codePointAt(index)!));
}

/**
 * Split `text` into plain and highlighted segments. Overlapping matches
 * merge into one segment that lists every term involved; matches that only
 * touch stay separate, so each segment's `terms` is exact.
 */
export function highlight(
  text: string,
  terms: readonly string[] | AhoCorasick,
  options: HighlightOptions = {},
): Segment[] {
  const automaton =
    terms instanceof AhoCorasick ? terms : new AhoCorasick(terms, options);
  const wholeWord = options.wholeWord ?? false;

  const matches: Match[] = [];
  for (const m of automaton.matchAll(text)) {
    if (
      wholeWord &&
      (isWordAt(text, m.start, true) || isWordAt(text, m.end, false))
    ) {
      continue;
    }
    matches.push(m);
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  let cursor = 0;
  const plain = (to: number) => {
    if (to > cursor) {
      segments.push({ text: text.slice(cursor, to), start: cursor, end: to, terms: [] });
    }
  };

  for (let i = 0; i < matches.length; ) {
    const first = matches[i]!;
    let end = first.end;
    const covered = new Set<number>();
    while (i < matches.length && matches[i]!.start < end) {
      end = Math.max(end, matches[i]!.end);
      covered.add(matches[i]!.pattern);
      i++;
    }
    plain(first.start);
    segments.push({
      text: text.slice(first.start, end),
      start: first.start,
      end,
      terms: [...covered].sort((a, b) => a - b),
    });
    cursor = end;
  }
  plain(text.length);
  return segments;
}
