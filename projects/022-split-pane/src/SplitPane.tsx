import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  initialState,
  keyToAction,
  normalizeLimits,
  pointerPercent,
  splitReducer,
  type SplitAction,
  type SplitDirection,
  type SplitLimits,
  type SplitState,
  type TextDirection,
} from "./split";

export interface SplitPaneProps {
  /** Accessible name of the separator, e.g. "Resize sidebar". */
  label: string;
  /** `row` puts the panes side by side, `column` stacks them. */
  direction?: SplitDirection;
  /** Initial size of the first pane, in percent. */
  defaultSize?: number;
  defaultCollapsed?: boolean;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  collapsible?: boolean;
  /** Remembers size and collapsed state in localStorage under this key. */
  storageKey?: string;
  onResize?: (state: { size: number; collapsed: boolean }) => void;
  className?: string;
  children: [ReactNode, ReactNode];
}

function readStored(key: string | undefined): Partial<SplitState> | null {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { size, collapsed } = parsed as Record<string, unknown>;
    return {
      size: typeof size === "number" && Number.isFinite(size) ? size : undefined,
      collapsed: typeof collapsed === "boolean" ? collapsed : undefined,
    };
  } catch {
    return null;
  }
}

export function SplitPane({
  label,
  direction = "row",
  defaultSize = 30,
  defaultCollapsed = false,
  min = 10,
  max = 90,
  step = 2,
  bigStep = 10,
  collapsible = false,
  storageKey,
  onResize,
  className,
  children,
}: SplitPaneProps) {
  const limits = useMemo<SplitLimits>(
    () => normalizeLimits({ min, max, step, bigStep, collapsible, collapsedSize: 0 }),
    [min, max, step, bigStep, collapsible],
  );

  // The reducer reads limits through a ref so prop changes don't need a new reducer.
  const limitsRef = useRef(limits);
  limitsRef.current = limits;
  const reducer = useCallback(
    (state: SplitState, action: SplitAction) => splitReducer(state, action, limitsRef.current),
    [],
  );

  const [state, dispatch] = useReducer(reducer, null, () => {
    // A collapsed pane stores the size it reopens to, so both cases go through initialState.
    const stored = readStored(storageKey);
    return initialState(stored?.size ?? defaultSize, stored?.collapsed ?? defaultCollapsed, limits);
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const primaryId = useId();

  // Read on demand: `dir` can change on an ancestor without this component re-rendering.
  const readTextDirection = (): TextDirection => {
    const el = containerRef.current;
    return el && getComputedStyle(el).direction === "rtl" ? "rtl" : "ltr";
  };

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const { size, collapsed, restoreSize } = state;

  useEffect(() => {
    onResizeRef.current?.({ size, collapsed });
  }, [size, collapsed]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ size: collapsed ? restoreSize : size, collapsed }));
    } catch {
      // Storage can be full or blocked; the pane still works without it.
    }
  }, [storageKey, size, collapsed, restoreSize]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const action = keyToAction(event.key, event.shiftKey, direction, readTextDirection(), limits);
    if (!action) return;
    event.preventDefault();
    dispatch(action);
  };

  const dragTo = (event: PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || dragOrigin.current === null) return;
    const percent = pointerPercent(
      container.getBoundingClientRect(),
      event.clientX,
      event.clientY,
      direction,
      readTextDirection(),
    );
    dispatch({ type: "drag", percent, origin: dragOrigin.current });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // preventDefault stops text selection but also the default focus, so focus by hand.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    dragOrigin.current = collapsed ? restoreSize : size;
    setDragging(true);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current === null) return;
    dragOrigin.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const valueNow = Math.round(size);
  const style = { "--split-size": `${size}` } as CSSProperties;
  const classes = ["split", `split--${direction}`, dragging && "is-dragging", collapsed && "is-collapsed", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={classes} style={style}>
      <div id={primaryId} className="split-pane split-pane--primary" inert={collapsed}>
        {children[0]}
      </div>
      <div
        className="split-separator"
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-controls={primaryId}
        // A separator between side-by-side panes is a vertical line, and vice versa.
        aria-orientation={direction === "row" ? "vertical" : "horizontal"}
        aria-valuenow={valueNow}
        aria-valuemin={collapsible ? limits.collapsedSize : Math.round(limits.min)}
        aria-valuemax={Math.round(limits.max)}
        aria-valuetext={collapsed ? "Collapsed" : `${valueNow}%`}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={dragTo}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onDoubleClick={() => dispatch({ type: "toggle" })}
      >
        <span className="split-grip" aria-hidden="true" />
      </div>
      <div className="split-pane split-pane--secondary">{children[1]}</div>
    </div>
  );
}
