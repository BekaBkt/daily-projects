/**
 * Myers' O(ND) difference algorithm.
 *
 * Finds a shortest edit script (fewest inserts + deletes) that turns `a` into
 * `b`, the same idea `git diff` and most diff viewers are built on.
 */

export type Edit<T> =
  | { kind: "equal"; value: T; aIndex: number; bIndex: number }
  | { kind: "delete"; value: T; aIndex: number }
  | { kind: "insert"; value: T; bIndex: number };

export type Equals<T> = (x: T, y: T) => boolean;

/**
 * Diff two sequences. Replacements come out as deletes followed by inserts,
 * which is the order unified diffs print them in.
 */
export function diff<T>(
  a: readonly T[],
  b: readonly T[],
  equals: Equals<T> = Object.is,
): Edit<T>[] {
  // Common prefix and suffix never need the search, and in real edits they
  // are usually most of the file. Trimming them shrinks N and M for free.
  let prefix = 0;
  const shorter = Math.min(a.length, b.length);
  while (prefix < shorter && equals(a[prefix]!, b[prefix]!)) prefix++;

  let suffix = 0;
  while (
    suffix < shorter - prefix &&
    equals(a[a.length - 1 - suffix]!, b[b.length - 1 - suffix]!)
  ) {
    suffix++;
  }

  const edits: Edit<T>[] = [];
  for (let i = 0; i < prefix; i++) {
    edits.push({ kind: "equal", value: a[i]!, aIndex: i, bIndex: i });
  }

  const middle = myers(
    a.slice(prefix, a.length - suffix),
    b.slice(prefix, b.length - suffix),
    equals,
  );
  for (const edit of middle) edits.push(shift(edit, prefix));

  for (let i = suffix; i > 0; i--) {
    const aIndex = a.length - i;
    const bIndex = b.length - i;
    edits.push({ kind: "equal", value: a[aIndex]!, aIndex, bIndex });
  }
  return edits;
}

/** Line diff for two strings. A trailing newline does not add an empty line. */
export function diffLines(a: string, b: string): Edit<string>[] {
  return diff(splitLines(a), splitLines(b));
}

/** Render edits as unified-diff body lines: " same", "-removed", "+added". */
export function toPatchLines(edits: readonly Edit<string>[]): string[] {
  const sign = { equal: " ", delete: "-", insert: "+" } as const;
  return edits.map((edit) => sign[edit.kind] + edit.value);
}

/** Number of inserted plus deleted items: the "D" in O(ND). */
export function distance<T>(edits: readonly Edit<T>[]): number {
  return edits.reduce((count, edit) => count + (edit.kind === "equal" ? 0 : 1), 0);
}

function splitLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function shift<T>(edit: Edit<T>, by: number): Edit<T> {
  switch (edit.kind) {
    case "equal":
      return { ...edit, aIndex: edit.aIndex + by, bIndex: edit.bIndex + by };
    case "delete":
      return { ...edit, aIndex: edit.aIndex + by };
    case "insert":
      return { ...edit, bIndex: edit.bIndex + by };
  }
}

/**
 * The core search. Think of an (N+1) x (M+1) grid where moving right deletes
 * a[x], moving down inserts b[y], and a diagonal is free when a[x] equals
 * b[y]. Diagonal k is every point with x - y = k.
 *
 * For each edit count d = 0, 1, 2, … we keep, per diagonal, the furthest x
 * reachable with exactly d edits (`v`). Each step extends one move from a
 * neighbouring diagonal and then follows the free "snake" as far as it goes.
 * The first d that reaches (N, M) is the minimum edit distance.
 */
function myers<T>(a: readonly T[], b: readonly T[], equals: Equals<T>): Edit<T>[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max + 1; // so v[k - 1] and v[k + 1] are always in bounds
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice()); // state after d - 1 edits, needed to walk back
    for (let k = -d; k <= d; k += 2) {
      // Come down from k + 1 (insert) or across from k - 1 (delete),
      // whichever got further. Edges of the band have only one option.
      const down = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!);
      let x = down ? v[offset + k + 1]! : v[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && equals(a[x]!, b[y]!)) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, offset);
    }
  }
  // Unreachable: d = n + m always reaches the corner.
  throw new Error("myers: no path found");
}

function backtrack<T>(
  trace: readonly Int32Array[],
  a: readonly T[],
  b: readonly T[],
  offset: number,
): Edit<T>[] {
  const reversed: Edit<T>[] = [];
  let x = a.length;
  let y = b.length;

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    const down = k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!);
    const prevK = down ? k + 1 : k - 1;
    const prevX = v[offset + prevK]!;
    const prevY = prevX - prevK;

    // Undo the snake first: it was walked after the single edit.
    while (x > prevX && y > prevY) {
      x--;
      y--;
      reversed.push({ kind: "equal", value: a[x]!, aIndex: x, bIndex: y });
    }
    if (d > 0) {
      if (down) {
        y--;
        reversed.push({ kind: "insert", value: b[y]!, bIndex: y });
      } else {
        x--;
        reversed.push({ kind: "delete", value: a[x]!, aIndex: x });
      }
    }
    x = prevX;
    y = prevY;
  }
  return reversed.reverse();
}
