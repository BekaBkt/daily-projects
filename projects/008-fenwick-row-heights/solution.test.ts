import { describe, expect, it } from "vitest";
import { RowHeights } from "./solution";

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

/** Obviously correct O(n) reference implementation. */
class NaiveRows {
  constructor(public heights: number[]) {}
  offsetOf(index: number): number {
    let sum = 0;
    for (let i = 0; i < index; i++) sum += this.heights[i]!;
    return sum;
  }
  indexAt(offset: number): number {
    const n = this.heights.length;
    if (n === 0 || !(offset > 0)) return 0;
    let top = 0;
    for (let i = 0; i < n; i++) {
      const bottom = top + this.heights[i]!;
      if (offset < bottom) return i;
      top = bottom;
    }
    return n - 1;
  }
}

describe("RowHeights basics", () => {
  it("builds from a fixed estimate", () => {
    const rows = new RowHeights(5, 40);
    expect(rows.count).toBe(5);
    expect(rows.total).toBe(200);
    expect(rows.offsetOf(0)).toBe(0);
    expect(rows.offsetOf(3)).toBe(120);
    expect(rows.get(4)).toBe(40);
  });

  it("builds from a per-row estimate", () => {
    const rows = new RowHeights(4, (i) => (i % 2 === 0 ? 20 : 60));
    expect(rows.total).toBe(160);
    expect(rows.offsetOf(2)).toBe(80);
  });

  it("returns the delta from set and updates every later offset", () => {
    const rows = new RowHeights(6, 30);
    expect(rows.set(2, 50)).toBe(20);
    expect(rows.set(2, 50)).toBe(0);
    expect(rows.offsetOf(2)).toBe(60);
    expect(rows.offsetOf(3)).toBe(110);
    expect(rows.total).toBe(200);
  });

  it("handles an empty list", () => {
    const rows = new RowHeights(0, 40);
    expect(rows.total).toBe(0);
    expect(rows.indexAt(100)).toBe(0);
    expect(rows.visibleRange(0, 500)).toEqual({ start: 0, end: 0, offsetTop: 0 });
  });

  it("rejects invalid input", () => {
    expect(() => new RowHeights(-1, 10)).toThrow(RangeError);
    expect(() => new RowHeights(3, -5)).toThrow(RangeError);
    const rows = new RowHeights(3, 10);
    expect(() => rows.get(3)).toThrow(RangeError);
    expect(() => rows.set(1.5, 10)).toThrow(RangeError);
    expect(() => rows.set(0, Number.NaN)).toThrow(RangeError);
    expect(() => rows.offsetOf(4)).toThrow(RangeError);
    expect(rows.offsetOf(3)).toBe(30);
  });
});

describe("indexAt", () => {
  const rows = new RowHeights(4, (i) => [10, 20, 30, 40][i]!);

  it("finds the row containing an offset", () => {
    expect(rows.indexAt(0)).toBe(0);
    expect(rows.indexAt(9.99)).toBe(0);
    expect(rows.indexAt(25)).toBe(1);
    expect(rows.indexAt(59)).toBe(2);
    expect(rows.indexAt(99)).toBe(3);
  });

  it("assigns a boundary to the row below it", () => {
    expect(rows.indexAt(10)).toBe(1);
    expect(rows.indexAt(30)).toBe(2);
    expect(rows.indexAt(60)).toBe(3);
  });

  it("clamps offsets outside the list", () => {
    expect(rows.indexAt(-50)).toBe(0);
    expect(rows.indexAt(Number.NaN)).toBe(0);
    expect(rows.indexAt(100)).toBe(3);
    expect(rows.indexAt(1e9)).toBe(3);
  });

  it("skips zero-height rows on a boundary", () => {
    const collapsed = new RowHeights(5, (i) => (i === 1 || i === 2 ? 0 : 10));
    expect(collapsed.indexAt(10)).toBe(3);
    expect(collapsed.indexAt(9)).toBe(0);
  });

  it("works for counts that are not powers of two", () => {
    for (const n of [1, 2, 3, 7, 8, 9, 31, 33]) {
      const list = new RowHeights(n, 5);
      for (let i = 0; i < n; i++) {
        expect(list.indexAt(i * 5 + 2)).toBe(i);
      }
    }
  });
});

describe("visibleRange", () => {
  const rows = new RowHeights(100, 50); // 5000px tall

  it("returns the rows inside the viewport", () => {
    expect(rows.visibleRange(0, 200)).toEqual({ start: 0, end: 4, offsetTop: 0 });
    expect(rows.visibleRange(120, 200)).toEqual({ start: 2, end: 7, offsetTop: 100 });
  });

  it("does not include a row that starts exactly at the bottom edge", () => {
    expect(rows.visibleRange(100, 150).end).toBe(5);
  });

  it("adds overscan and clamps it to the list", () => {
    expect(rows.visibleRange(0, 200, 3)).toEqual({ start: 0, end: 7, offsetTop: 0 });
    expect(rows.visibleRange(1000, 200, 2)).toEqual({ start: 18, end: 26, offsetTop: 900 });
    expect(rows.visibleRange(4900, 400, 5).end).toBe(100);
  });

  it("follows measured heights", () => {
    const list = new RowHeights(10, 50);
    list.set(0, 300);
    expect(list.visibleRange(0, 200)).toEqual({ start: 0, end: 1, offsetTop: 0 });
    expect(list.visibleRange(310, 100)).toEqual({ start: 1, end: 4, offsetTop: 300 });
  });

  it("rejects a bad overscan", () => {
    expect(() => rows.visibleRange(0, 100, -1)).toThrow(RangeError);
  });
});

describe("scrollTopFor", () => {
  const rows = new RowHeights(20, 40); // 800px tall, 200px viewport

  it("aligns to start, end and center", () => {
    expect(rows.scrollTopFor(5, 200, "start")).toBe(200);
    expect(rows.scrollTopFor(5, 200, "end")).toBe(40);
    expect(rows.scrollTopFor(5, 200, "center")).toBe(120);
  });

  it("clamps to the scrollable range", () => {
    expect(rows.scrollTopFor(0, 200, "end")).toBe(0);
    expect(rows.scrollTopFor(19, 200, "start")).toBe(600);
  });

  it("moves as little as possible with auto", () => {
    expect(rows.scrollTopFor(6, 200, "auto", 200)).toBe(200); // already visible
    expect(rows.scrollTopFor(2, 200, "auto", 200)).toBe(80); // above: align start
    expect(rows.scrollTopFor(12, 200, "auto", 200)).toBe(320); // below: align end
  });
});

describe("resize", () => {
  it("keeps measured rows and estimates new ones", () => {
    const rows = new RowHeights(3, 10);
    rows.set(1, 99);
    rows.resize(5);
    expect(rows.count).toBe(5);
    expect(rows.get(1)).toBe(99);
    expect(rows.get(4)).toBe(10);
    expect(rows.total).toBe(10 + 99 + 10 + 10 + 10);
    rows.resize(2);
    expect(rows.total).toBe(109);
    expect(() => rows.get(2)).toThrow(RangeError);
  });
});

describe("against a naive oracle", () => {
  it("matches after random measurements and resizes", () => {
    const random = mulberry32(8);
    for (let round = 0; round < 50; round++) {
      const n = Math.floor(random() * 200);
      const estimate = 10 + Math.floor(random() * 40);
      const rows = new RowHeights(n, estimate);
      const naive = new NaiveRows(Array.from({ length: n }, () => estimate));

      for (let op = 0; op < 300; op++) {
        const count = naive.heights.length;
        const roll = random();
        if (roll < 0.02) {
          const next = Math.floor(random() * 200);
          rows.resize(next);
          naive.heights = Array.from({ length: next }, (_, i) => naive.heights[i] ?? estimate);
        } else if (roll < 0.6 && count > 0) {
          // Integer heights (including zero) keep float sums exact.
          const i = Math.floor(random() * count);
          const h = Math.floor(random() * 120);
          const expectedDelta = h - naive.heights[i]!;
          expect(rows.set(i, h)).toBe(expectedDelta);
          naive.heights[i] = h;
        } else if (roll < 0.8) {
          const i = Math.floor(random() * (count + 1));
          expect(rows.offsetOf(i)).toBe(naive.offsetOf(i));
        } else {
          const offset = (random() * 1.1 - 0.05) * naive.offsetOf(count);
          expect(rows.indexAt(offset)).toBe(naive.indexAt(offset));
        }
      }
      expect(rows.total).toBe(naive.offsetOf(naive.heights.length));
    }
  });

  it("stays close with fractional heights", () => {
    const random = mulberry32(42);
    const rows = new RowHeights(1000, 33.3);
    const naive = new NaiveRows(Array.from({ length: 1000 }, () => 33.3));
    for (let op = 0; op < 5000; op++) {
      const i = Math.floor(random() * 1000);
      const h = 20 + random() * 80;
      rows.set(i, h);
      naive.heights[i] = h;
    }
    for (let i = 0; i <= 1000; i += 37) {
      expect(rows.offsetOf(i)).toBeCloseTo(naive.offsetOf(i), 6);
    }
  });
});
