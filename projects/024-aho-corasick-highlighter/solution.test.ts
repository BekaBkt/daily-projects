import { describe, expect, it } from "vitest";
import { AhoCorasick, type Match, fold, highlight } from "./solution";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (m: Match) => `${m.start}:${m.end}:${m.pattern}`;
const keys = (ms: Iterable<Match>) => [...ms].map(key).sort();

/** The obvious O(n · m · k) version: try every pattern at every offset. */
function bruteForce(text: string, patterns: string[]): Match[] {
  const out: Match[] = [];
  patterns.forEach((p, pattern) => {
    if (p.length === 0) return;
    for (let start = 0; start + p.length <= text.length; start++) {
      if (text.startsWith(p, start)) out.push({ start, end: start + p.length, pattern });
    }
  });
  return out;
}

const marked = (text: string, terms: string[], options = {}) =>
  highlight(text, terms, options)
    .map((s) => (s.terms.length ? `[${s.text}]` : s.text))
    .join("");

describe("AhoCorasick.matchAll", () => {
  it("finds the textbook he / she / his / hers example", () => {
    const ac = new AhoCorasick(["he", "she", "his", "hers"], { ignoreCase: false });
    expect([...ac.matchAll("ushers")]).toEqual([
      { start: 1, end: 4, pattern: 1 }, // she
      { start: 2, end: 4, pattern: 0 }, // he, via the dictionary link
      { start: 2, end: 6, pattern: 3 }, // hers
    ]);
  });

  it("reports overlapping and nested matches", () => {
    const ac = new AhoCorasick(["aa", "a"], { ignoreCase: false });
    expect(keys(ac.matchAll("aaa"))).toEqual(
      ["0:1:1", "1:2:1", "2:3:1", "0:2:0", "1:3:0"].sort(),
    );
  });

  it("reports duplicate patterns under each index and ignores empty ones", () => {
    const ac = new AhoCorasick(["ab", "", "ab"], { ignoreCase: false });
    expect(keys(ac.matchAll("xab"))).toEqual(["1:3:0", "1:3:2"]);
    expect(new AhoCorasick([""]).size).toBe(1);
  });

  it("orders matches by end, longest first", () => {
    const ac = new AhoCorasick(["c", "bc", "abc"], { ignoreCase: false });
    expect([...ac.matchAll("abc")].map((m) => m.pattern)).toEqual([2, 1, 0]);
  });

  it("agrees with brute force on 2,000 random cases", () => {
    const rand = mulberry32(24);
    const alphabet = "abc";
    const word = (max: number) => {
      const len = Math.floor(rand() * max);
      let s = "";
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
      return s;
    };
    for (let run = 0; run < 2000; run++) {
      const patterns = Array.from({ length: 1 + Math.floor(rand() * 6) }, () => word(5));
      const text = word(40);
      const ac = new AhoCorasick(patterns, { ignoreCase: false });
      expect(keys(ac.matchAll(text))).toEqual(keys(bruteForce(text, patterns)));
    }
  });

  it("handles astral characters with correct UTF-16 offsets", () => {
    const ac = new AhoCorasick(["🍕b"]);
    expect([...ac.matchAll("a🍕b")]).toEqual([{ start: 1, end: 4, pattern: 0 }]);
  });
});

describe("fold", () => {
  it("maps every folded unit back to the source", () => {
    const f = fold("İx", { ignoreCase: true });
    expect(f.text).toBe("i̇x"); // İ lowercases to two units
    expect(f.starts).toEqual([0, 0, 1]);
    expect(f.ends).toEqual([1, 1, 2]);
  });

  it("drops marks and stretches the previous character over them", () => {
    const f = fold("Cé!", { ignoreAccents: true });
    expect(f.text).toBe("ce!");
    expect(f.ends).toEqual([1, 3, 4]);
  });
});

describe("highlight", () => {
  it("is case-insensitive by default and keeps the source casing", () => {
    expect(marked("Focus Rings matter", ["focus", "RINGS"])).toBe("[Focus] [Rings] matter");
  });

  it("can match accents loosely, including precomposed and decomposed text", () => {
    const opts = { ignoreAccents: true };
    expect(marked("Café or café", ["cafe"], opts)).toBe("[Café] or [café]");
    expect(marked("İstanbul, Istanbul", ["istanbul"], opts)).toBe("[İstanbul], [Istanbul]");
    expect(marked("Café", ["cafe"])).toBe("Café");
  });

  it("merges overlapping matches and lists every term", () => {
    const segments = highlight("keyboard", ["key", "board", "yboa"]);
    expect(segments).toEqual([{ text: "keyboard", start: 0, end: 8, terms: [0, 1, 2] }]);
  });

  it("keeps touching matches as separate segments", () => {
    expect(highlight("redblue", ["red", "blue"]).map((s) => s.terms)).toEqual([[0], [1]]);
  });

  it("supports whole-word matching across scripts", () => {
    const opts = { wholeWord: true };
    expect(marked("cat concat cat_ cat.", ["cat"], opts)).toBe("[cat] concat cat_ [cat].");
    expect(marked("кот котик", ["кот"], opts)).toBe("[кот] котик");
    expect(marked("𝒜cat cat", ["cat"], opts)).toBe("𝒜cat [cat]");
  });

  it("reuses a prebuilt automaton", () => {
    const ac = new AhoCorasick(["ts", "tsx"]);
    expect(highlight("App.tsx", ac)).toEqual(highlight("App.tsx", ["ts", "tsx"]));
    expect(highlight("App.tsx", ac).at(-1)).toEqual({ text: "tsx", start: 4, end: 7, terms: [0, 1] });
  });

  it("returns the whole text as one plain segment when nothing matches", () => {
    expect(highlight("hello", ["xyz"])).toEqual([{ text: "hello", start: 0, end: 5, terms: [] }]);
    expect(highlight("", ["a"])).toEqual([]);
  });

  it("covers the source exactly, in order", () => {
    const rand = mulberry32(7);
    for (let run = 0; run < 300; run++) {
      const text = Array.from({ length: 30 }, () => "aAbé "[Math.floor(rand() * 5)]).join("");
      const segments = highlight(text, ["ab", "ba", "é", "a a"], { ignoreAccents: true });
      expect(segments.map((s) => s.text).join("")).toBe(text);
      segments.forEach((s, i) => {
        expect(text.slice(s.start, s.end)).toBe(s.text);
        if (i > 0) expect(s.start).toBe(segments[i - 1]!.end);
      });
    }
  });
});
