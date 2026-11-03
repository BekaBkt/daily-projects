import { describe, expect, it } from "vitest";
import { diff, diffLines, distance, toPatchLines, type Edit } from "./solution";

const chars = (s: string) => s.split("");

/** Rebuild both inputs from an edit script. */
function apply<T>(edits: readonly Edit<T>[]): { a: T[]; b: T[] } {
  const a: T[] = [];
  const b: T[] = [];
  for (const edit of edits) {
    if (edit.kind !== "insert") a.push(edit.value);
    if (edit.kind !== "delete") b.push(edit.value);
  }
  return { a, b };
}

/** Classic O(NM) LCS, used as an independent oracle for the minimum distance. */
function lcsLength<T>(a: readonly T[], b: readonly T[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1]!);
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/** Small seeded PRNG so the randomized test is reproducible. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("diff", () => {
  it("returns nothing for two empty inputs", () => {
    expect(diff([], [])).toEqual([]);
  });

  it("marks everything equal when inputs match", () => {
    const edits = diff(chars("abc"), chars("abc"));
    expect(edits.map((e) => e.kind)).toEqual(["equal", "equal", "equal"]);
    expect(distance(edits)).toBe(0);
  });

  it("inserts everything when a is empty, deletes everything when b is empty", () => {
    expect(diff([], chars("xy")).map((e) => e.kind)).toEqual(["insert", "insert"]);
    expect(diff(chars("xy"), []).map((e) => e.kind)).toEqual(["delete", "delete"]);
  });

  it("finds the D = 5 script for the example from Myers' paper", () => {
    const a = chars("ABCABBA");
    const b = chars("CBABAC");
    const edits = diff(a, b);
    expect(distance(edits)).toBe(5);
    expect(apply(edits)).toEqual({ a, b });
  });

  it("puts deletes before inserts in a replacement", () => {
    expect(toPatchLines(diff(["old"], ["new"]))).toEqual(["-old", "+new"]);
  });

  it("keeps indices pointing at the original positions", () => {
    const a = chars("kitten");
    const b = chars("sitting");
    for (const edit of diff(a, b)) {
      if (edit.kind !== "insert") expect(a[edit.aIndex]).toBe(edit.value);
      if (edit.kind !== "delete") expect(b[edit.bIndex]).toBe(edit.value);
    }
  });

  it("accepts a custom equality", () => {
    const sameIgnoringCase = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
    expect(distance(diff(chars("Hello"), chars("hELLO"), sameIgnoringCase))).toBe(0);
  });

  it("matches the LCS oracle on random inputs", () => {
    const random = mulberry32(4);
    const word = () =>
      Array.from({ length: Math.floor(random() * 12) }, () => "abc"[Math.floor(random() * 3)]!);

    for (let run = 0; run < 500; run++) {
      const a = word();
      const b = word();
      const edits = diff(a, b);
      expect(apply(edits)).toEqual({ a, b });
      expect(distance(edits)).toBe(a.length + b.length - 2 * lcsLength(a, b));
    }
  });
});

describe("diffLines", () => {
  it("diffs a small file edit", () => {
    const before = "import a\nimport b\n\nrun(a)\n";
    const after = "import a\nimport c\n\nrun(a)\nrun(c)\n";
    expect(toPatchLines(diffLines(before, after))).toEqual([
      " import a",
      "-import b",
      "+import c",
      " ",
      " run(a)",
      "+run(c)",
    ]);
  });

  it("treats CRLF and LF the same and ignores one trailing newline", () => {
    expect(distance(diffLines("a\r\nb\r\n", "a\nb"))).toBe(0);
    expect(diffLines("", "")).toEqual([]);
  });
});
