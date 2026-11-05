import {
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

export type Range = readonly [number, number];

export interface RangeSliderProps {
  /** Visible label for the whole control. */
  label: string;
  min: number;
  max: number;
  value: Range;
  onChange: (next: Range) => void;
  step?: number;
  /** Jump used by PageUp / PageDown. Defaults to 10 steps. */
  largeStep?: number;
  /** Smallest allowed distance between the two thumbs. */
  minGap?: number;
  /** Turns a raw number into text for the bubbles and screen readers. */
  formatValue?: (value: number) => string;
  thumbLabels?: readonly [string, string];
  disabled?: boolean;
  /** Decoration drawn behind the track, e.g. a histogram. */
  background?: ReactNode;
}

type Thumb = 0 | 1;

interface Drag {
  pointerId: number;
  thumb: Thumb;
  /** Both thumbs sit on the same value: pick one by drag direction. */
  undecided: boolean;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

function decimalsOf(n: number): number {
  const [, frac = ""] = String(n).split(".");
  return frac.length;
}

export function RangeSlider({
  label,
  min,
  max,
  value,
  onChange,
  step = 1,
  largeStep = step * 10,
  minGap = 0,
  formatValue = String,
  thumbLabels = ["Minimum", "Maximum"],
  disabled = false,
  background,
}: RangeSliderProps) {
  const labelId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const dragRef = useRef<Drag | null>(null);
  // Pointer events can arrive faster than React re-renders; read the latest value.
  const valueRef = useRef(value);
  valueRef.current = value;

  const [lo, hi] = value;
  const span = max - min || 1;
  const pct = (n: number) => ((n - min) / span) * 100;
  const precision = decimalsOf(step);

  const snap = (raw: number) => {
    const stepped = Math.round((raw - min) / step) * step + min;
    return Number(clamp(stepped, min, max).toFixed(precision));
  };

  /** Limits each thumb so the pair never crosses or gets closer than minGap. */
  const bounds = (thumb: Thumb, [a, b]: Range): [number, number] =>
    thumb === 0 ? [min, b - minGap] : [a + minGap, max];

  const commit = (thumb: Thumb, raw: number) => {
    const current = valueRef.current;
    const [floor, ceil] = bounds(thumb, current);
    const next = clamp(snap(raw), floor, ceil);
    if (next === current[thumb]) return;
    const updated: Range = thumb === 0 ? [next, current[1]] : [current[0], next];
    valueRef.current = updated;
    onChange(updated);
  };

  const valueAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return min + ratio * span;
  };

  const handleKeyDown = (thumb: Thumb) => (e: KeyboardEvent) => {
    if (disabled) return;
    const current = valueRef.current[thumb];
    const [floor, ceil] = bounds(thumb, valueRef.current);
    const moves: Record<string, number> = {
      ArrowRight: current + step,
      ArrowUp: current + step,
      ArrowLeft: current - step,
      ArrowDown: current - step,
      PageUp: current + largeStep,
      PageDown: current - largeStep,
      Home: floor,
      End: ceil,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    commit(thumb, moves[e.key]);
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const raw = valueAt(e.clientX);
    const [a, b] = valueRef.current;
    const onThumb = (e.target as HTMLElement).closest<HTMLElement>("[data-thumb]")
      ?.dataset.thumb;

    let thumb: Thumb;
    let undecided = false;
    if (a === b) {
      thumb = raw < a ? 0 : 1;
      undecided = onThumb !== undefined;
    } else if (onThumb !== undefined) {
      thumb = Number(onThumb) as Thumb;
    } else {
      thumb = Math.abs(raw - a) <= Math.abs(raw - b) ? 0 : 1;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, thumb, undecided };
    thumbRefs.current[thumb]?.focus();
    // A press on the bare track jumps the nearest thumb there; a press on a thumb only grabs it.
    if (onThumb === undefined) commit(thumb, raw);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const raw = valueAt(e.clientX);
    if (drag.undecided) {
      const shared = valueRef.current[0];
      if (snap(raw) === shared) return;
      drag.thumb = raw < shared ? 0 : 1;
      drag.undecided = false;
      thumbRefs.current[drag.thumb]?.focus();
    }
    commit(drag.thumb, raw);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // When both thumbs are pushed to the right end, the low thumb must be on top
  // or it could never be grabbed again.
  const lowOnTop = pct(lo) > 50;

  return (
    <div className="range" role="group" aria-labelledby={labelId} data-disabled={disabled || undefined}>
      <div className="range__header">
        <span id={labelId} className="range__label">
          {label}
        </span>
        <output className="range__summary" aria-hidden="true">
          {formatValue(lo)} – {formatValue(hi)}
        </output>
      </div>

      <div
        ref={trackRef}
        className="range__area"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {background && (
          <div className="range__background" aria-hidden="true">
            {background}
          </div>
        )}
        <div className="range__track" aria-hidden="true">
          <div
            className="range__fill"
            style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
          />
        </div>

        {([0, 1] as const).map((thumb) => {
          const v = value[thumb];
          const [floor, ceil] = bounds(thumb, value);
          return (
            <div
              key={thumb}
              ref={(el) => {
                thumbRefs.current[thumb] = el;
              }}
              data-thumb={thumb}
              className="range__thumb"
              style={{
                left: `${pct(v)}%`,
                zIndex: (thumb === 0) === lowOnTop ? 3 : 2,
              }}
              role="slider"
              tabIndex={disabled ? -1 : 0}
              aria-label={thumbLabels[thumb]}
              aria-valuemin={floor}
              aria-valuemax={ceil}
              aria-valuenow={v}
              aria-valuetext={formatValue(v)}
              aria-orientation="horizontal"
              aria-disabled={disabled || undefined}
              onKeyDown={handleKeyDown(thumb)}
            >
              <span className="range__bubble" aria-hidden="true">
                {formatValue(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
