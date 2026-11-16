/**
 * Day-view calendar layout: place overlapping events side by side.
 *
 * Times are plain numbers (minutes since midnight works well) and every
 * event is the half-open interval [start, end), so a 10:00–11:00 meeting
 * and an 11:00–12:00 meeting touch but do not overlap.
 */

export interface TimedEvent {
  start: number;
  end: number;
}

export interface LayoutOptions {
  /**
   * Shortest visual length of an event. A 0-minute reminder still needs a
   * row of pixels, and anything drawn taller than its real duration has to
   * be treated as that tall here, or it will be painted over its neighbours.
   * Zero-length events are rejected unless this is above 0.
   */
  minDuration?: number;
}

export interface PlacedEvent<E extends TimedEvent> {
  event: E;
  /** Effective end after `minDuration` is applied. */
  end: number;
  /** Index of the overlap cluster (a group of transitively overlapping events). */
  cluster: number;
  /** Column the event sits in, 0-based. */
  column: number;
  /** How many columns it is drawn across after expanding right. */
  span: number;
  /** Total columns in its cluster; the event is `span / columns` wide. */
  columns: number;
}

/** Binary min-heap over an arbitrary comparator. */
export class MinHeap<T> {
  private readonly items: T[] = [];
  private readonly less: (a: T, b: T) => boolean;

  constructor(less: (a: T, b: T) => boolean) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(value: T): void {
    const items = this.items;
    items.push(value);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(items[i]!, items[parent]!)) break;
      [items[i], items[parent]] = [items[parent]!, items[i]!];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || last === undefined) return top;
    items[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      if (l < items.length && this.less(items[l]!, items[smallest]!)) smallest = l;
      if (r < items.length && this.less(items[r]!, items[smallest]!)) smallest = r;
      if (smallest === i) break;
      [items[i], items[smallest]] = [items[smallest]!, items[i]!];
      i = smallest;
    }
    return top;
  }

  clear(): void {
    this.items.length = 0;
  }
}
