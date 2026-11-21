import { describe, expect, it } from "vitest";
import {
  type Line,
  raggedness,
  wrapBalanced,
  wrapGreedy,
  wrapPretty,
  wrapText,
} from "./solution";

/** Monospace: one unit per character, one unit per space. */
const mono = (word: string) => word.length;
const widthsOf = (text: string) => text.split(" ").map(mono);

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

/** Every way to split n words into lines: 2^(n-1) sets of break points. */
function* allLayouts(widths: number[], space: number): Generator<Line[]> {
  const n = widths.length;
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const lines: Line[] = [];
    let start = 0;
    for (let k = 1; k <= n; k++) {
      if (k === n || mask & (1 << (k - 1))) {
        const words = widths.slice(start, k);
        const width = words.reduce((a, b) => a + b, 0) + space * (words.length - 1);
        lines.push({ start, end: k, width });
        start = k;
      }
    }
    yield lines;
  }
}

const feasible = (lines: Line[], maxWidth: number) =>
  lines.every((l) => l.end - l.start === 1 || l.width <= maxWidth + 1e-9);

function prettyCost(lines: Line[], maxWidth: number, orphanPenalty: number) {
  const last = lines[lines.length - 1]!;
  const orphan = lines.length > 1 && last.end - last.start === 1 ? orphanPenalty : 0;
  // Overflowing single words are free, matching the solution.
  const ragged = lines
    .slice(0, -1)
    .reduce((sum, l) => sum + (l.width > maxWidth ? 0 : (maxWidth - l.width) ** 2), 0);
  return ragged + orphan;
}

const maxLine = (lines: Line[]) => Math.max(...lines.map((l) => l.width));

function expectWellFormed(lines: Line[], n: number, maxWidth: number) {
  expect(lines[0]?.start ?? 0).toBe(0);
  expect(lines[lines.length - 1]?.end ?? 0).toBe(n);
  for (let i = 1; i < lines.length; i++) {
    expect(lines[i]!.start).toBe(lines[i - 1]!.end);
  }
  expect(feasible(lines, maxWidth)).toBe(true);
}

describe("wrapGreedy", () => {
  it("fills each line before starting the next", () => {
    const lines = wrapText("the quick brown fox jumps over the lazy dog", mono, {
      maxWidth: 15,
      mode: "greedy",
    });
    expect(lines).toEqual(["the quick brown", "fox jumps over", "the lazy dog"]);
  });

  it("counts the space between words", () => {
    // 5 + 1 + 5 = 11 does not fit in 10, even though 5 + 5 would.
    expect(wrapGreedy([5, 5], { maxWidth: 10, spaceWidth: 1 })).toHaveLength(2);
    expect(wrapGreedy([5, 5], { maxWidth: 11, spaceWidth: 1 })).toHaveLength(1);
  });

  it("puts an overlong word on its own line", () => {
    const lines = wrapText("a supercalifragilistic b", mono, { maxWidth: 8, mode: "greedy" });
    expect(lines).toEqual(["a", "supercalifragilistic", "b"]);
  });

  it("tolerates float drift in pixel widths", () => {
    // 0.1 + 0.2 is 0.30000000000000004.
    expect(wrapGreedy([0.1, 0.2], { maxWidth: 0.3 })).toHaveLength(1);
  });
});

describe("wrapBalanced", () => {
  it("evens out a headline without adding lines", () => {
    const text = "Accessible components start with the keyboard";
    expect(wrapText(text, mono, { maxWidth: 30, mode: "greedy" })).toEqual([
      "Accessible components start",
      "with the keyboard",
    ]);
    expect(wrapText(text, mono, { maxWidth: 30, mode: "balance" })).toEqual([
      "Accessible components",
      "start with the keyboard",
    ]);
  });

  it("leaves text that fits on one line alone", () => {
    expect(wrapBalanced(widthsOf("short title"), { maxWidth: 40, spaceWidth: 1 })).toEqual([
      { start: 0, end: 2, width: 11 },
    ]);
  });

  it("handles overlong words", () => {
    const widths = [3, 50, 3, 3];
    const lines = wrapBalanced(widths, { maxWidth: 10, spaceWidth: 1 });
    expect(lines).toHaveLength(wrapGreedy(widths, { maxWidth: 10, spaceWidth: 1 }).length);
    expectWellFormed(lines, widths.length, 10);
  });
});

describe("wrapPretty", () => {
  it("pulls a word down instead of leaving one alone on the last line", () => {
    const text = "Keyboard focus should always be visible on every control";
    const greedy = wrapText(text, mono, { maxWidth: 20, mode: "greedy" });
    const pretty = wrapText(text, mono, { maxWidth: 20 });

    expect(greedy.at(-1)!.split(" ")).toHaveLength(1);
    expect(pretty.at(-1)!.split(" ").length).toBeGreaterThan(1);
    expect(pretty).toHaveLength(greedy.length);
  });

  it("with no orphan penalty, only raggedness matters", () => {
    // Greedy: "aaa bb" (6) / "cc" → a full first line, raggedness 0.
    // Alternative: "aaa" / "bb cc" → slack 3, raggedness 9.
    const widths = [3, 2, 2];
    const opts = { maxWidth: 6, spaceWidth: 1 };
    expect(wrapPretty(widths, { ...opts, orphanPenalty: 0 })).toEqual(wrapGreedy(widths, opts));
    // A penalty above 9 makes the lone "cc" the worse option.
    expect(wrapPretty(widths, { ...opts, orphanPenalty: 10 }).map((l) => l.end)).toEqual([1, 3]);
  });

  it("is never more ragged than greedy when orphans are free", () => {
    const text = "aaa bb cccc d eeeee ff g hhhh ii jjjjjj k lll mm nnnn o";
    const widths = widthsOf(text);
    const opts = { maxWidth: 12, spaceWidth: 1, orphanPenalty: 0 };
    expect(raggedness(wrapPretty(widths, opts), 12)).toBeLessThanOrEqual(
      raggedness(wrapGreedy(widths, opts), 12),
    );
  });

  it("returns nothing for no words and one line for one word", () => {
    expect(wrapPretty([], { maxWidth: 10 })).toEqual([]);
    expect(wrapPretty([4], { maxWidth: 10 })).toEqual([{ start: 0, end: 1, width: 4 }]);
    expect(wrapText("   ", mono, { maxWidth: 10 })).toEqual([]);
  });
});

describe("input validation", () => {
  it.each([0, -5, NaN, Infinity])("rejects maxWidth %s", (maxWidth) => {
    expect(() => wrapGreedy([1], { maxWidth })).toThrow(RangeError);
  });

  it("rejects bad word and space widths", () => {
    expect(() => wrapPretty([1, -1], { maxWidth: 10 })).toThrow(/word 1/);
    expect(() => wrapBalanced([1, NaN], { maxWidth: 10 })).toThrow(RangeError);
    expect(() => wrapGreedy([1], { maxWidth: 10, spaceWidth: -1 })).toThrow(RangeError);
    expect(() => wrapPretty([1], { maxWidth: 10, orphanPenalty: -1 })).toThrow(RangeError);
  });
});

describe("against brute force", () => {
  const cases = Array.from({ length: 1500 }, (_, seed) => {
    const rand = mulberry32(seed + 20);
    const n = 1 + Math.floor(rand() * 11);
    // Mix integer widths (lots of ties) with fractional ones (pixel-like).
    const integer = rand() < 0.5;
    const widths = Array.from({ length: n }, () =>
      integer ? 1 + Math.floor(rand() * 9) : 0.5 + rand() * 9,
    );
    const maxWidth = integer ? 6 + Math.floor(rand() * 20) : 6 + rand() * 20;
    const spaceWidth = rand() < 0.2 ? 0 : integer ? 1 : 0.3 + rand();
    return { widths, maxWidth, spaceWidth };
  });

  it("greedy uses the fewest possible lines", () => {
    for (const { widths, maxWidth, spaceWidth } of cases) {
      const lines = wrapGreedy(widths, { maxWidth, spaceWidth });
      expectWellFormed(lines, widths.length, maxWidth);

      let fewest = Infinity;
      for (const layout of allLayouts(widths, spaceWidth)) {
        if (feasible(layout, maxWidth)) fewest = Math.min(fewest, layout.length);
      }
      expect(lines.length).toBe(fewest);
    }
  });

  it("pretty finds the minimum cost layout", () => {
    for (const { widths, maxWidth, spaceWidth } of cases) {
      const orphanPenalty = (maxWidth / 2) ** 2;
      const lines = wrapPretty(widths, { maxWidth, spaceWidth });
      expectWellFormed(lines, widths.length, maxWidth);

      let best = Infinity;
      for (const layout of allLayouts(widths, spaceWidth)) {
        if (feasible(layout, maxWidth)) {
          best = Math.min(best, prettyCost(layout, maxWidth, orphanPenalty));
        }
      }
      expect(prettyCost(lines, maxWidth, orphanPenalty)).toBeCloseTo(best, 6);
    }
  });

  it("balance keeps the line count and minimises the longest line", () => {
    for (const { widths, maxWidth, spaceWidth } of cases) {
      const k = wrapGreedy(widths, { maxWidth, spaceWidth }).length;
      const lines = wrapBalanced(widths, { maxWidth, spaceWidth });
      expectWellFormed(lines, widths.length, maxWidth);
      expect(lines).toHaveLength(k);

      let best = Infinity;
      for (const layout of allLayouts(widths, spaceWidth)) {
        if (layout.length === k && feasible(layout, maxWidth)) {
          best = Math.min(best, maxLine(layout));
        }
      }
      expect(maxLine(lines)).toBeCloseTo(best, 6);
    }
  });
});
