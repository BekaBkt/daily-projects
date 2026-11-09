import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

/** Returns a copy of `list` with the item at `from` moved to `to`. */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface ItemState<T> {
  /** Position the item occupies right now, including an in-progress drag. */
  index: number;
  /** True for the item that is being moved. */
  active: boolean;
  /** The whole list in its previewed order, for values that depend on neighbours. */
  order: readonly T[];
}

export interface SortableListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** Plain-text name used in the handle label and screen reader announcements. */
  getLabel: (item: T) => string;
  renderItem: (item: T, state: ItemState<T>) => ReactNode;
  onReorder: (from: number, to: number) => void;
  /** Accessible name of the list. */
  label: string;
  className?: string;
}

interface Slot {
  top: number;
  height: number;
}

type Drag =
  | { mode: "keyboard"; key: string; from: number; index: number }
  | { mode: "pointer"; key: string; from: number; index: number; dy: number; slots: Slot[]; gap: number };

interface PendingPointer {
  pointerId: number;
  key: string;
  from: number;
  startY: number;
  slots: Slot[];
  gap: number;
  active: boolean;
}

/** Pixels a pointer has to travel before a press on the handle becomes a drag. */
const DRAG_THRESHOLD = 4;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where the dragged item lands for a given pointer offset, and the clamped offset itself. */
function pointerTarget(p: PendingPointer, clientY: number) {
  const { slots, from } = p;
  const first = slots[0];
  const last = slots[slots.length - 1];
  const self = slots[from];
  const minDy = first.top - self.top;
  const maxDy = last.top + last.height - (self.top + self.height);
  const dy = Math.min(maxDy, Math.max(minDy, clientY - p.startY));

  // The new index is the number of other items whose midpoint sits above the dragged item's center.
  const center = self.top + self.height / 2 + dy;
  let index = 0;
  slots.forEach((s, j) => {
    if (j !== from && s.top + s.height / 2 < center) index++;
  });
  return { dy, index };
}

export function SortableList<T>({
  items,
  getKey,
  getLabel,
  renderItem,
  onReorder,
  label,
  className,
}: SortableListProps<T>) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", id: 0 });
  const instructionsId = useId();

  const itemEls = useRef(new Map<string, HTMLLIElement>());
  const handleEls = useRef(new Map<string, HTMLButtonElement>());
  const firstTops = useRef<Map<string, number> | null>(null);
  const pending = useRef<PendingPointer | null>(null);
  const refocus = useRef<string | null>(null);

  const announce = (text: string) => setAnnouncement((a) => ({ text, id: a.id + 1 }));
  const position = (i: number) => `position ${i + 1} of ${items.length}`;

  /** FLIP "first": remember where every item is on screen before the order changes. */
  const snapshot = () => {
    const tops = new Map<string, number>();
    for (const [key, el] of itemEls.current) tops.set(key, el.getBoundingClientRect().top);
    firstTops.current = tops;
  };

  // FLIP "last, invert, play": slide each item from its old screen position to its new one.
  useLayoutEffect(() => {
    if (refocus.current) {
      handleEls.current.get(refocus.current)?.focus();
      refocus.current = null;
    }

    const first = firstTops.current;
    if (!first) return;
    firstTops.current = null;
    const animate = !reducedMotion();

    for (const [key, el] of itemEls.current) {
      el.getAnimations().forEach((a) => a.cancel());
      const top = first.get(key);
      if (!animate || top === undefined) continue;
      const delta = top - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 0.5) continue;
      el.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
        duration: 220,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      });
    }
  });

  const finish = (d: Drag, commit: boolean) => {
    const name = getLabel(items[d.from]);
    snapshot();
    setDrag(null);
    if (!commit) {
      announce(`Reorder cancelled. ${name} returned to ${position(d.from)}.`);
    } else if (d.index === d.from) {
      announce(`${name} dropped. Position unchanged.`);
    } else {
      onReorder(d.from, d.index);
      announce(`${name} dropped at ${position(d.index)}.`);
    }
  };

  // ---------- keyboard ----------

  const onHandleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (drag?.mode === "pointer") {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pending.current) e.currentTarget.releasePointerCapture(pending.current.pointerId);
        pending.current = null;
        finish(drag, false);
      }
      return;
    }

    if (!drag) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const from = items.findIndex((item) => getKey(item) === key);
        setDrag({ mode: "keyboard", key, from, index: from });
        announce(
          `Picked up ${getLabel(items[from])}, ${position(from)}. ` +
            "Use the arrow keys to move, Space to drop, Escape to cancel.",
        );
      }
      return;
    }

    let next = drag.index;
    switch (e.key) {
      case "ArrowUp":
        next = Math.max(0, drag.index - 1);
        break;
      case "ArrowDown":
        next = Math.min(items.length - 1, drag.index + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        finish(drag, true);
        return;
      case "Escape":
        e.preventDefault();
        refocus.current = key;
        finish(drag, false);
        return;
      default:
        return;
    }

    e.preventDefault();
    if (next === drag.index) return;
    // React moves the DOM node to reorder it, which drops focus; put it back after the commit.
    refocus.current = key;
    snapshot();
    setDrag({ ...drag, index: next });
    announce(`${getLabel(items[drag.from])} moved to ${position(next)}.`);
  };

  const onHandleBlur = () => {
    // A blur caused by our own DOM move is not the user leaving.
    if (drag?.mode !== "keyboard" || refocus.current) return;
    finish(drag, false);
  };

  // ---------- pointer ----------

  const onHandlePointerDown = (e: PointerEvent<HTMLButtonElement>, key: string) => {
    if (e.button !== 0 || drag) return;
    const from = items.findIndex((item) => getKey(item) === key);

    const slots = items.map((item) => {
      const el = itemEls.current.get(getKey(item))!;
      el.getAnimations().forEach((a) => a.finish());
      const r = el.getBoundingClientRect();
      return { top: r.top, height: r.height };
    });
    const gap = slots.length > 1 ? slots[1].top - (slots[0].top + slots[0].height) : 0;

    e.currentTarget.setPointerCapture(e.pointerId);
    pending.current = { pointerId: e.pointerId, key, from, startY: e.clientY, slots, gap, active: false };
  };

  const onHandlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = pending.current;
    if (!p || p.pointerId !== e.pointerId) return;
    if (!p.active) {
      if (Math.abs(e.clientY - p.startY) < DRAG_THRESHOLD) return;
      p.active = true;
      announce(`Picked up ${getLabel(items[p.from])}.`);
    }
    const { dy, index } = pointerTarget(p, e.clientY);
    setDrag({ mode: "pointer", key: p.key, from: p.from, index, dy, slots: p.slots, gap: p.gap });
  };

  const onHandlePointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const p = pending.current;
    if (!p || p.pointerId !== e.pointerId) return;
    pending.current = null;
    if (!p.active) return;
    const { index } = pointerTarget(p, e.clientY);
    finish({ mode: "pointer", key: p.key, from: p.from, index, dy: 0, slots: p.slots, gap: p.gap }, true);
  };

  const onHandlePointerCancel = () => {
    pending.current = null;
    if (drag?.mode === "pointer") finish(drag, false);
  };

  /** While pointer-dragging, the DOM keeps its order and items are moved with transforms. */
  const offsetFor = (i: number): number => {
    if (drag?.mode !== "pointer") return 0;
    if (i === drag.from) return drag.dy;
    const span = drag.slots[drag.from].height + drag.gap;
    if (drag.from < i && i <= drag.index) return -span;
    if (drag.index <= i && i < drag.from) return span;
    return 0;
  };

  // Keyboard drags render the preview order directly; pointer drags only preview it for `index`.
  const preview = drag ? arrayMove(items, drag.from, drag.index) : items;
  const rendered = drag?.mode === "keyboard" ? preview : items;
  const previewIndex = new Map(preview.map((item, i) => [getKey(item), i]));
  const originalIndex = new Map(items.map((item, i) => [getKey(item), i]));

  return (
    <div className={["sortable", className].filter(Boolean).join(" ")} data-dragging={drag?.mode}>
      <p id={instructionsId} hidden>
        Press Space or Enter to pick up. While picked up, use the Up and Down arrow keys to move,
        Home and End to jump to the start or end, Space or Enter to drop, and Escape to cancel.
      </p>

      <ul className="sortable__list" aria-label={label}>
        {rendered.map((item) => {
          const key = getKey(item);
          const name = getLabel(item);
          const active = drag?.key === key;
          const offset = offsetFor(originalIndex.get(key) ?? 0);

          return (
            <li
              key={key}
              ref={(el) => {
                if (el) itemEls.current.set(key, el);
                else itemEls.current.delete(key);
              }}
              className="sortable__item"
              data-active={active || undefined}
              style={offset ? { transform: `translateY(${offset}px)` } : undefined}
            >
              <button
                type="button"
                ref={(el) => {
                  if (el) handleEls.current.set(key, el);
                  else handleEls.current.delete(key);
                }}
                className="sortable__handle"
                aria-label={`Reorder ${name}`}
                aria-describedby={instructionsId}
                aria-pressed={active}
                onKeyDown={(e) => onHandleKeyDown(e, key)}
                onBlur={onHandleBlur}
                onPointerDown={(e) => onHandlePointerDown(e, key)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerCancel}
              >
                <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
                  {[3, 9].map((cx) =>
                    [3, 9, 15].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" />),
                  )}
                </svg>
              </button>
              <div className="sortable__content">
                {renderItem(item, { index: previewIndex.get(key) ?? 0, active, order: preview })}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="sortable__live" aria-live="assertive" aria-atomic="true">
        {/* Alternating a trailing space makes repeated messages count as a change. */}
        {announcement.text + (announcement.id % 2 ? " " : "")}
      </p>
    </div>
  );
}
