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

interface Busy {
  end: number;
  column: number;
}

/**
 * Lay out a day's events into columns.
 *
 * 1. Sort by start (longer first on ties, then input order).
 * 2. Sweep: free every column whose event ended at or before this start,
 *    then take the lowest free column, or open a new one. When nothing is
 *    busy any more the current cluster is closed and columns reset.
 * 3. Let each event grow right across columns that are empty for its
 *    whole duration.
 *
 * Returns one entry per input event, in input order.
 */
export function layoutEvents<E extends TimedEvent>(
  events: readonly E[],
  options: LayoutOptions = {},
): PlacedEvent<E>[] {
  const minDuration = options.minDuration ?? 0;
  if (!(minDuration >= 0)) throw new RangeError("minDuration must be >= 0");

  const placed: PlacedEvent<E>[] = events.map((event, i) => {
    if (!Number.isFinite(event.start) || !Number.isFinite(event.end)) {
      throw new RangeError(`event ${i} has a non-finite time`);
    }
    if (event.end < event.start) {
      throw new RangeError(`event ${i} ends before it starts`);
    }
    const end = Math.max(event.end, event.start + minDuration);
    if (end === event.start) {
      // [s, s) overlaps nothing, so it has no honest place in a column.
      throw new RangeError(`event ${i} has zero length; pass a minDuration`);
    }
    return {
      event,
      end,
      cluster: 0,
      column: 0,
      span: 1,
      columns: 1,
    };
  });

  const order = placed
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = placed[a]!;
      const pb = placed[b]!;
      return pa.event.start - pb.event.start || pb.end - pa.end || a - b;
    });

  const busy = new MinHeap<Busy>((a, b) => a.end < b.end || (a.end === b.end && a.column < b.column));
  const free = new MinHeap<number>((a, b) => a < b);

  let cluster = -1;
  let columnCount = 0;
  let members: PlacedEvent<E>[] = [];

  const closeCluster = () => {
    if (members.length === 0) return;
    expandCluster(members, columnCount);
    members = [];
  };

  for (const index of order) {
    const p = placed[index]!;
    const start = p.event.start;

    while (busy.size > 0 && busy.peek()!.end <= start) {
      free.push(busy.pop()!.column);
    }

    if (busy.size === 0) {
      closeCluster();
      cluster += 1;
      columnCount = 0;
      free.clear();
    }

    const column = free.size > 0 ? free.pop()! : columnCount++;
    p.cluster = cluster;
    p.column = column;
    busy.push({ end: p.end, column });
    members.push(p);
  }
  closeCluster();

  return placed;
}

/**
 * Within one cluster, events in a column are disjoint and were added in
 * start order, so both their starts and their ends are ascending. That lets
 * "is column j free during [s, e)?" be a binary search instead of a scan.
 */
function expandCluster<E extends TimedEvent>(members: PlacedEvent<E>[], columns: number): void {
  const byColumn: PlacedEvent<E>[][] = Array.from({ length: columns }, () => []);
  for (const p of members) byColumn[p.column]!.push(p);

  for (const p of members) {
    p.columns = columns;
    let span = 1;
    for (let j = p.column + 1; j < columns; j++) {
      if (columnOverlaps(byColumn[j]!, p.event.start, p.end)) break;
      span += 1;
    }
    p.span = span;
  }
}

function columnOverlaps<E extends TimedEvent>(
  column: readonly PlacedEvent<E>[],
  start: number,
  end: number,
): boolean {
  // First event in the column whose end is after `start`.
  let lo = 0;
  let hi = column.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (column[mid]!.end <= start) lo = mid + 1;
    else hi = mid;
  }
  const candidate = column[lo];
  return candidate !== undefined && candidate.event.start < end;
}

export interface Box {
  top: number;
  height: number;
  /** Percent of the day column's width. */
  left: number;
  /** Percent of the day column's width. */
  width: number;
}

/** Turn a placement into absolute-position numbers for a day column. */
export function toBox<E extends TimedEvent>(
  p: PlacedEvent<E>,
  { dayStart = 0, pxPerMinute = 1 }: { dayStart?: number; pxPerMinute?: number } = {},
): Box {
  return {
    top: (p.event.start - dayStart) * pxPerMinute,
    height: (p.end - p.event.start) * pxPerMinute,
    left: (p.column / p.columns) * 100,
    width: (p.span / p.columns) * 100,
  };
}
