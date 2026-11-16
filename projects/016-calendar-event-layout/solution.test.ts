import { describe, expect, it } from "vitest";
import { MinHeap, layoutEvents, toBox, type PlacedEvent, type TimedEvent } from "./solution";

interface Ev extends TimedEvent {
  id: string;
}

const ev = (id: string, start: number, end: number): Ev => ({ id, start, end });

/** "09:30" → 570 */
const t = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

const summary = (placed: PlacedEvent<Ev>[]) =>
  Object.fromEntries(placed.map((p) => [p.event.id, [p.column, p.span, p.columns]]));

const overlaps = (a: PlacedEvent<TimedEvent>, b: PlacedEvent<TimedEvent>) =>
  a.event.start < b.end && b.event.start < a.end;

describe("MinHeap", () => {
  it("pops in order", () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    for (const n of [5, 1, 4, 1, 9, 2, 6]) heap.push(n);
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop()!);
    expect(out).toEqual([1, 1, 2, 4, 5, 6, 9]);
    expect(heap.pop()).toBeUndefined();
  });
});

describe("layoutEvents", () => {
  it("gives a lone event the full width", () => {
    const [p] = layoutEvents([ev("a", t("09:00"), t("10:00"))]);
    expect(p).toMatchObject({ column: 0, span: 1, columns: 1, cluster: 0 });
  });

  it("treats back-to-back events as separate clusters", () => {
    const placed = layoutEvents([ev("a", t("09:00"), t("10:00")), ev("b", t("10:00"), t("11:00"))]);
    expect(summary(placed)).toEqual({ a: [0, 1, 1], b: [0, 1, 1] });
    expect(placed.map((p) => p.cluster)).toEqual([0, 1]);
  });

  it("splits two overlapping events in half", () => {
    const placed = layoutEvents([ev("a", t("09:00"), t("10:00")), ev("b", t("09:30"), t("10:30"))]);
    expect(summary(placed)).toEqual({ a: [0, 1, 2], b: [1, 1, 2] });
  });

  it("reuses a freed column and expands into empty ones", () => {
    // a: 9–12 long block, b: 9–10, c: 9–10, d: 10–11 drops into b's column
    // and, since c's column is empty after 10:00, stretches over it.
    const placed = layoutEvents([
      ev("a", t("09:00"), t("12:00")),
      ev("b", t("09:00"), t("10:00")),
      ev("c", t("09:00"), t("10:00")),
      ev("d", t("10:00"), t("11:00")),
    ]);
    expect(summary(placed)).toEqual({
      a: [0, 1, 3],
      b: [1, 1, 3],
      c: [2, 1, 3],
      d: [1, 2, 3],
    });
  });

  it("keeps the whole chain in one cluster even if the ends never meet", () => {
    // a overlaps b, b overlaps c, a and c do not touch. Still one cluster,
    // so all three share the same column count.
    const placed = layoutEvents([
      ev("a", t("09:00"), t("10:00")),
      ev("b", t("09:30"), t("11:00")),
      ev("c", t("10:30"), t("11:30")),
    ]);
    expect(new Set(placed.map((p) => p.cluster)).size).toBe(1);
    expect(summary(placed)).toEqual({ a: [0, 1, 2], b: [1, 1, 2], c: [0, 1, 2] });
  });

  it("puts the longer event first on equal starts", () => {
    const placed = layoutEvents([ev("short", t("09:00"), t("09:30")), ev("long", t("09:00"), t("11:00"))]);
    expect(summary(placed)).toEqual({ long: [0, 1, 2], short: [1, 1, 2] });
  });

  it("returns results in input order regardless of start order", () => {
    const input = [ev("late", 600, 660), ev("early", 480, 540), ev("mid", 500, 620)];
    expect(layoutEvents(input).map((p) => p.event.id)).toEqual(["late", "early", "mid"]);
  });

  it("applies minDuration to short and zero-length events", () => {
    const placed = layoutEvents([ev("ping", t("09:00"), t("09:00")), ev("next", t("09:10"), t("09:40"))], {
      minDuration: 15,
    });
    expect(placed[0]!.end).toBe(t("09:15"));
    expect(summary(placed)).toEqual({ ping: [0, 1, 2], next: [1, 1, 2] });
  });

  it("rejects invalid input", () => {
    expect(() => layoutEvents([ev("x", 10, 5)])).toThrow(RangeError);
    expect(() => layoutEvents([ev("x", 10, 10)])).toThrow(/zero length/);
    expect(() => layoutEvents([ev("x", 0, Number.NaN)])).toThrow(RangeError);
    expect(() => layoutEvents([], { minDuration: -1 })).toThrow(RangeError);
  });

  it("handles an empty day", () => {
    expect(layoutEvents([])).toEqual([]);
  });
});

describe("toBox", () => {
  it("maps a placement to pixels and percentages", () => {
    const placed = layoutEvents([
      ev("a", t("09:00"), t("12:00")),
      ev("b", t("09:00"), t("10:00")),
      ev("c", t("09:00"), t("10:00")),
      ev("d", t("10:00"), t("11:00")),
    ]);
    const d = toBox(placed[3]!, { dayStart: t("08:00"), pxPerMinute: 2 });
    expect(d.top).toBe(240);
    expect(d.height).toBe(120);
    expect(d.left).toBeCloseTo(100 / 3);
    expect(d.width).toBeCloseTo(200 / 3);
  });
});

// ---------------------------------------------------------------------------
// Oracle: the same spec written the slow, obvious way.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

interface Slow {
  cluster: number;
  column: number;
  span: number;
  columns: number;
}

function slowLayout(events: readonly Ev[]): Slow[] {
  const n = events.length;
  const ov = (i: number, j: number) => events[i]!.start < events[j]!.end && events[j]!.start < events[i]!.end;

  // Clusters: connected components of the overlap graph, via union-find.
  const parent = events.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (ov(i, j)) parent[find(i)] = find(j);

  const order = events
    .map((_, i) => i)
    .sort((a, b) => events[a]!.start - events[b]!.start || events[b]!.end - events[a]!.end || a - b);

  const column = new Array<number>(n).fill(-1);
  for (const i of order) {
    let c = 0;
    while (order.some((j) => column[j] === c && ov(i, j))) c++;
    column[i] = c;
  }

  const roots = [...new Set(order.map((i) => find(i)))];
  return events.map((_, i) => {
    const mates = events.map((_, j) => j).filter((j) => find(j) === find(i));
    const columns = Math.max(...mates.map((j) => column[j]!)) + 1;
    let span = 1;
    while (
      column[i]! + span < columns &&
      !mates.some((j) => column[j] === column[i]! + span && ov(i, j))
    ) {
      span++;
    }
    return { cluster: roots.indexOf(find(i)), column: column[i]!, span, columns };
  });
}

function randomDay(rand: () => number, count: number, grid: number): Ev[] {
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(rand() * grid);
    const length = 1 + Math.floor(rand() * rand() * grid * 0.4);
    return ev(`e${i}`, start, start + length);
  });
}

describe("layoutEvents vs brute force", () => {
  it("agrees on 3,000 seeded random days", () => {
    const rand = mulberry32(16);
    for (let round = 0; round < 3000; round++) {
      const day = randomDay(rand, 1 + Math.floor(rand() * 14), 8 + Math.floor(rand() * 40));
      const fast = layoutEvents(day).map(({ cluster, column, span, columns }) => ({ cluster, column, span, columns }));
      expect(fast, JSON.stringify(day)).toEqual(slowLayout(day));
    }
  });

  it("never draws two overlapping events on top of each other", () => {
    const rand = mulberry32(2026);
    for (let round = 0; round < 500; round++) {
      const placed = layoutEvents(randomDay(rand, 30, 96));
      for (const a of placed) {
        expect(a.column + a.span).toBeLessThanOrEqual(a.columns);
        for (const b of placed) {
          if (a === b || !overlaps(a, b)) continue;
          expect(a.cluster).toBe(b.cluster);
          const disjoint = a.column + a.span <= b.column || b.column + b.span <= a.column;
          expect(disjoint).toBe(true);
        }
      }
    }
  });

  it("uses exactly as many columns as the busiest moment needs", () => {
    const rand = mulberry32(7);
    for (let round = 0; round < 500; round++) {
      const placed = layoutEvents(randomDay(rand, 25, 60));
      const byCluster = new Map<number, PlacedEvent<Ev>[]>();
      for (const p of placed) byCluster.set(p.cluster, [...(byCluster.get(p.cluster) ?? []), p]);
      for (const members of byCluster.values()) {
        // Peak concurrency is reached at some event's start.
        const peak = Math.max(
          ...members.map((p) => members.filter((q) => q.event.start <= p.event.start && p.event.start < q.end).length),
        );
        expect(members[0]!.columns).toBe(peak);
      }
    }
  });

  it("lays out 10,000 events quickly", () => {
    const rand = mulberry32(1);
    const day = randomDay(rand, 10_000, 24 * 60 * 7);
    const t0 = Date.now();
    const placed = layoutEvents(day);
    expect(placed).toHaveLength(10_000);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
