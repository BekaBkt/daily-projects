import { describe, expect, it } from "vitest";
import { SCORE, fuzzyFilter, fuzzyMatch, highlight, positionBonuses, scoreAlignment } from "./solution";

/** Small seeded PRNG so random cases are reproducible when one fails. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Try every alignment. Exponential, but fine for strings of 10 characters. */
function bruteForceBest(query: string, target: string, caseSensitive: boolean): number | null {
  const fold = (c: string) => (caseSensitive ? c : c.toLowerCase());
  let best: number | null = null;
  const positions: number[] = [];
  const walk = (i: number, from: number) => {
    if (i === query.length) {
      const score = scoreAlignment(target, positions);
      if (best === null || score > best) best = score;
      return;
    }
    for (let j = from; j < target.length; j++) {
      if (fold(target[j]!) !== fold(query[i]!)) continue;
      positions.push(j);
      walk(i + 1, j + 1);
      positions.pop();
    }
  };
  walk(0, 0);
  return best;
}

describe("positionBonuses", () => {
  it("rewards the start, delimiters, camel humps and digits", () => {
    expect(Array.from(positionBonuses("getUser_id2"))).toEqual([
      SCORE.boundary, 0, 0, SCORE.camel, 0, 0, 0, 0, SCORE.boundary, 0, SCORE.camel,
    ]);
  });

  it("gives no bonus to delimiters themselves or to runs of capitals", () => {
    expect(Array.from(positionBonuses("-HTML"))).toEqual([0, SCORE.boundary, 0, 0, 0]);
  });
});

describe("fuzzyMatch", () => {
  it("matches an empty query with score 0", () => {
    expect(fuzzyMatch("", "anything")).toEqual({ score: 0, positions: [] });
  });

  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyMatch("abc", "acb")).toBeNull();
    expect(fuzzyMatch("long query", "short")).toBeNull();
    expect(fuzzyMatch("a", "")).toBeNull();
  });

  it("uses smart case", () => {
    expect(fuzzyMatch("fb", "FooBar")?.positions).toEqual([0, 3]);
    expect(fuzzyMatch("FB", "foobar")).toBeNull();
    expect(fuzzyMatch("FB", "FooBar")?.positions).toEqual([0, 3]);
    expect(fuzzyMatch("fb", "FooBar", { caseSensitive: true })).toBeNull();
  });

  it("follows camelCase humps", () => {
    expect(fuzzyMatch("gcp", "getCurrentPosition")?.positions).toEqual([0, 3, 10]);
  });

  it("prefers a word boundary over an earlier mid-word match", () => {
    expect(fuzzyMatch("ab", "xab_ab")?.positions).toEqual([4, 5]);
  });

  it("is not fooled by a greedy leftmost start", () => {
    // Greedy takes the leading `a` and then pays for a long gap.
    const match = fuzzyMatch("ab", "axxxxxxx_ab");
    expect(match?.positions).toEqual([9, 10]);
    expect(match!.score).toBeGreaterThan(scoreAlignment("axxxxxxx_ab", [0, 10]));
  });

  it("matches path segments", () => {
    expect(fuzzyMatch("scb", "src/components/Button.tsx")?.positions).toEqual([0, 4, 15]);
  });

  it("keeps indices stable when lowercasing would change length", () => {
    // "İ".toLowerCase() is two code units; folding per unit keeps positions aligned.
    expect(fuzzyMatch("x", "İx")?.positions).toEqual([1]);
  });

  it("returns positions whose score is the reported score", () => {
    const target = "packages/ui/src/useFocusTrap.test.tsx";
    const match = fuzzyMatch("uftt", target)!;
    expect(scoreAlignment(target, match.positions)).toBe(match.score);
  });

  it("finds the optimal alignment on random inputs (checked by brute force)", () => {
    const alphabet = "aAbB_ 1/";
    for (let seed = 1; seed <= 40; seed++) {
      const rand = mulberry32(seed);
      const pick = (len: number) =>
        Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
      for (let round = 0; round < 50; round++) {
        const target = pick(1 + Math.floor(rand() * 10));
        const query = pick(1 + Math.floor(rand() * 4));
        const caseSensitive = query !== query.toLowerCase();
        const expected = bruteForceBest(query, target, caseSensitive);
        const match = fuzzyMatch(query, target);

        if (expected === null) {
          expect(match).toBeNull();
          continue;
        }
        expect(match).not.toBeNull();
        expect(match!.score).toBe(expected);
        expect(scoreAlignment(target, match!.positions)).toBe(expected);
        match!.positions.forEach((j, i) => {
          if (i > 0) expect(j).toBeGreaterThan(match!.positions[i - 1]!);
          const fold = (c: string) => (caseSensitive ? c : c.toLowerCase());
          expect(fold(target[j]!)).toBe(fold(query[i]!));
        });
      }
    }
  });
});

describe("fuzzyFilter", () => {
  const commands = ["mouse", "user_settings", "useState", "Toggle Sidebar"];

  it("ranks by score, then shorter text, then input order", () => {
    // useState and user_settings tie on score; the shorter one wins.
    const ranked = fuzzyFilter("us", commands, (c) => c).map((r) => r.item);
    expect(ranked).toEqual(["useState", "user_settings", "mouse"]);
  });

  it("drops non-matches and respects the limit", () => {
    expect(fuzzyFilter("tsb", commands, (c) => c).map((r) => r.item)).toEqual(["Toggle Sidebar"]);
    expect(fuzzyFilter("us", commands, (c) => c, { limit: 1 })).toHaveLength(1);
  });

  it("works with objects through getText", () => {
    const files = [{ path: "src/App.tsx" }, { path: "src/app/main.ts" }];
    const [first] = fuzzyFilter("app", files, (f) => f.path);
    expect(first?.item).toBe(files[0]);
  });
});

describe("highlight", () => {
  it("groups matched characters into runs", () => {
    expect(highlight("useState", [0, 1, 3])).toEqual([
      { text: "us", match: true },
      { text: "e", match: false },
      { text: "S", match: true },
      { text: "tate", match: false },
    ]);
  });

  it("handles no matches and empty text", () => {
    expect(highlight("abc", [])).toEqual([{ text: "abc", match: false }]);
    expect(highlight("", [])).toEqual([]);
  });
});
