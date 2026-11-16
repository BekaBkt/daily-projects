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
