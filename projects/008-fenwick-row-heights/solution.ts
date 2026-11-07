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
