/**
 * Row offsets for a virtualized list whose rows have different heights.
 *
 * A virtual list only renders the rows inside the viewport, so on every
 * scroll it has to answer two questions:
 *
 *   1. "Which row sits at scrollTop = y?"   (scroll position -> index)
 *   2. "How far down does row i start?"     (index -> pixel offset)
 *
 * Rows start with an estimated height and get their real height once they
 * are measured, so the heights keep changing. A plain prefix-sum array makes
 * (2) O(1) but every measurement O(n); recomputing sums makes the opposite
 * trade. A Fenwick (binary indexed) tree does both in O(log n).
 */

export type Estimate = number | ((index: number) => number);

export type Align = "start" | "center" | "end" | "auto";

export interface VisibleRange {
  /** First row to render (inclusive), overscan included. */
  start: number;
  /** Row after the last one to render (exclusive), overscan included. */
  end: number;
  /** Pixel offset of `start`, for positioning the rendered slice. */
  offsetTop: number;
}

export class RowHeights {
  /** 1-based Fenwick tree: tree[i] holds the sum of heights (i - lowbit(i), i]. */
  #tree: Float64Array;
  /** Plain copy of every height, so `get` is O(1) and `set` can compute a delta. */
  #heights: Float64Array;
  #estimate: (index: number) => number;

  constructor(count: number, estimate: Estimate) {
    assertCount(count);
    this.#estimate = typeof estimate === "number" ? () => estimate : estimate;
    this.#heights = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      this.#heights[i] = assertHeight(this.#estimate(i));
    }
    this.#tree = build(this.#heights);
  }

  get count(): number {
    return this.#heights.length;
  }

  /** Total scroll height of the list. O(log n). */
  get total(): number {
    return this.offsetOf(this.count);
  }

  /** Height of row `index`. O(1). */
  get(index: number): number {
    this.#assertIndex(index);
    return this.#heights[index]!;
  }

  /**
   * Record a measured height. Returns the change in pixels, which a list can
   * add to scrollTop when the row is above the viewport to keep content from
   * jumping (scroll anchoring). O(log n).
   */
  set(index: number, height: number): number {
    this.#assertIndex(index);
    const delta = assertHeight(height) - this.#heights[index]!;
    if (delta === 0) return 0;
    this.#heights[index] = height;
    const tree = this.#tree;
    for (let i = index + 1; i < tree.length; i += i & -i) {
      tree[i]! += delta;
    }
    return delta;
  }

  /** Pixel offset where row `index` starts: the sum of rows [0, index). O(log n). */
  offsetOf(index: number): number {
    if (!Number.isInteger(index) || index < 0 || index > this.count) {
      throw new RangeError(`offsetOf: ${index} is outside 0..${this.count}`);
    }
    let sum = 0;
    for (let i = index; i > 0; i -= i & -i) {
      sum += this.#tree[i]!;
    }
    return sum;
  }

  /**
   * Index of the row that contains pixel `offset`, clamped to the list.
   * A row owns [offsetOf(i), offsetOf(i + 1)), so a boundary belongs to the
   * row below it and zero-height rows are never returned for a boundary.
   *
   * Binary lifting over the tree: walk the powers of two from the top and
   * take each jump whose block still fits in the remaining offset. That is
   * O(log n), instead of O(log² n) for a binary search over `offsetOf`.
   */
  indexAt(offset: number): number {
    const n = this.count;
    if (n === 0) return 0;
    if (!(offset > 0)) return 0; // also catches NaN
    const tree = this.#tree;
    let pos = 0;
    let remaining = offset;
    for (let step = highestPowerOfTwo(n); step > 0; step >>= 1) {
      const next = pos + step;
      if (next <= n && tree[next]! <= remaining) {
        pos = next;
        remaining -= tree[next]!;
      }
    }
    // `pos` rows end at or before `offset`, so the row containing it is `pos`.
    return Math.min(pos, n - 1);
  }

  /** Rows to render for a viewport, with `overscan` extra rows on each side. */
  visibleRange(scrollTop: number, viewportHeight: number, overscan = 0): VisibleRange {
    const n = this.count;
    if (n === 0) return { start: 0, end: 0, offsetTop: 0 };
    if (!Number.isInteger(overscan) || overscan < 0) {
      throw new RangeError(`visibleRange: overscan must be a non-negative integer`);
    }

    const top = Math.max(0, scrollTop);
    const bottom = top + Math.max(0, viewportHeight);
    const first = this.indexAt(top);
    let last = this.indexAt(bottom);
    // A row that starts exactly at the bottom edge is not visible yet.
    if (last > first && this.offsetOf(last) >= bottom) last--;

    const start = Math.max(0, first - overscan);
    const end = Math.min(n, last + 1 + overscan);
    return { start, end, offsetTop: this.offsetOf(start) };
  }

  /**
   * scrollTop that brings row `index` into view, clamped to the scrollable
   * range. "auto" scrolls only as far as needed, like
   * `scrollIntoView({ block: "nearest" })`, and keeps `currentScrollTop`
   * when the row is already fully visible.
   */
  scrollTopFor(index: number, viewportHeight: number, align: Align = "auto", currentScrollTop = 0): number {
    this.#assertIndex(index);
    const rowTop = this.offsetOf(index);
    const rowBottom = rowTop + this.#heights[index]!;
    const maxScroll = Math.max(0, this.total - viewportHeight);

    let target: number;
    switch (align) {
      case "start":
        target = rowTop;
        break;
      case "end":
        target = rowBottom - viewportHeight;
        break;
      case "center":
        target = rowTop - (viewportHeight - (rowBottom - rowTop)) / 2;
        break;
      case "auto":
        if (rowTop < currentScrollTop) target = rowTop;
        else if (rowBottom > currentScrollTop + viewportHeight) target = rowBottom - viewportHeight;
        else target = currentScrollTop;
        break;
    }
    return Math.min(maxScroll, Math.max(0, target));
  }

  /**
   * Change the row count, e.g. when an infinite list loads another page.
   * Measured heights are kept, new rows get the estimate, and the tree is
   * rebuilt in O(n).
   */
  resize(count: number): void {
    assertCount(count);
    const old = this.#heights;
    if (count === old.length) return;
    const next = new Float64Array(count);
    next.set(count < old.length ? old.subarray(0, count) : old);
    for (let i = old.length; i < count; i++) {
      next[i] = assertHeight(this.#estimate(i));
    }
    this.#heights = next;
    this.#tree = build(next);
  }

  #assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.count) {
      throw new RangeError(`row ${index} is outside 0..${this.count - 1}`);
    }
  }
}

/**
 * Linear-time construction: each node pushes its partial sum to its parent
 * once, instead of n separate O(log n) updates.
 */
function build(heights: Float64Array): Float64Array {
  const n = heights.length;
  const tree = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    tree[i]! += heights[i - 1]!;
    const parent = i + (i & -i);
    if (parent <= n) tree[parent]! += tree[i]!;
  }
  return tree;
}

function highestPowerOfTwo(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

function assertCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`row count must be a non-negative integer, got ${count}`);
  }
}

function assertHeight(height: number): number {
  if (!Number.isFinite(height) || height < 0) {
    throw new RangeError(`row height must be a finite number >= 0, got ${height}`);
  }
  return height;
}
