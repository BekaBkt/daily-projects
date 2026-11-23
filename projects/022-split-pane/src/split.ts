export type SplitDirection = "row" | "column";
export type TextDirection = "ltr" | "rtl";

/** Sizes are percentages of the primary (first) pane. */
export interface SplitLimits {
  min: number;
  max: number;
  /** Arrow key step. */
  step: number;
  /** Shift + arrow / PageUp / PageDown step. */
  bigStep: number;
  collapsible: boolean;
  /** Size used while collapsed, usually 0. */
  collapsedSize: number;
}

export interface SplitState {
  size: number;
  collapsed: boolean;
  /** Size to go back to when the pane is expanded again. */
  restoreSize: number;
}

export type SplitAction =
  | { type: "step"; delta: number }
  | { type: "min" }
  | { type: "max" }
  | { type: "toggle" }
  /** `percent` is where the pointer is, `origin` the size when the drag started. */
  | { type: "drag"; percent: number; origin: number };

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 10) / 10;

export function normalizeLimits(limits: SplitLimits): SplitLimits {
  const min = clamp(limits.min, 0, 100);
  const max = clamp(limits.max, min, 100);
  return {
    ...limits,
    min,
    max,
    step: Math.max(0.1, limits.step),
    bigStep: Math.max(limits.step, limits.bigStep),
    collapsedSize: clamp(limits.collapsedSize, 0, min),
  };
}

export function initialState(size: number, collapsed: boolean, limits: SplitLimits): SplitState {
  const open = clamp(size, limits.min, limits.max);
  return limits.collapsible && collapsed
    ? { size: limits.collapsedSize, collapsed: true, restoreSize: open }
    : { size: open, collapsed: false, restoreSize: open };
}

function collapse(state: SplitState, limits: SplitLimits, restoreSize: number): SplitState {
  if (!limits.collapsible) return { ...state, size: limits.min, collapsed: false };
  return {
    size: limits.collapsedSize,
    collapsed: true,
    restoreSize: clamp(restoreSize, limits.min, limits.max),
  };
}

function open(size: number, limits: SplitLimits): SplitState {
  const next = round(clamp(size, limits.min, limits.max));
  return { size: next, collapsed: false, restoreSize: next };
}

export function splitReducer(state: SplitState, action: SplitAction, limits: SplitLimits): SplitState {
  switch (action.type) {
    case "step": {
      if (state.collapsed) {
        // Growing a collapsed pane opens it at its minimum, shrinking does nothing.
        return action.delta > 0 ? open(limits.min, limits) : state;
      }
      const next = state.size + action.delta;
      if (next < limits.min && limits.collapsible && state.size <= limits.min) {
        // Already at the minimum: one more step down collapses.
        return collapse(state, limits, state.restoreSize);
      }
      return open(next, limits);
    }
    case "min":
      return limits.collapsible ? collapse(state, limits, state.collapsed ? state.restoreSize : state.size) : open(limits.min, limits);
    case "max":
      return open(limits.max, limits);
    case "toggle":
      if (!limits.collapsible) return state;
      return state.collapsed ? open(state.restoreSize, limits) : collapse(state, limits, state.size);
    case "drag": {
      // Snap shut once the pointer is past the halfway point between collapsed and min.
      const snapAt = (limits.collapsedSize + limits.min) / 2;
      if (limits.collapsible && action.percent < snapAt) {
        return state.collapsed ? state : collapse(state, limits, Math.max(action.origin, limits.min));
      }
      return open(action.percent, limits);
    }
  }
}

/**
 * Maps a keydown on the separator to an action. Arrow keys follow the visual
 * direction, so in RTL `ArrowLeft` grows the first pane (which sits on the right).
 */
export function keyToAction(
  key: string,
  shiftKey: boolean,
  direction: SplitDirection,
  textDirection: TextDirection,
  limits: SplitLimits,
): SplitAction | null {
  const amount = shiftKey ? limits.bigStep : limits.step;
  const grow = direction === "column" ? "ArrowDown" : textDirection === "rtl" ? "ArrowLeft" : "ArrowRight";
  const shrink = direction === "column" ? "ArrowUp" : textDirection === "rtl" ? "ArrowRight" : "ArrowLeft";

  switch (key) {
    case grow:
      return { type: "step", delta: amount };
    case shrink:
      return { type: "step", delta: -amount };
    case "PageDown":
      return { type: "step", delta: limits.bigStep };
    case "PageUp":
      return { type: "step", delta: -limits.bigStep };
    case "Home":
      return { type: "min" };
    case "End":
      return { type: "max" };
    case "Enter":
      return limits.collapsible ? { type: "toggle" } : null;
    default:
      return null;
  }
}

/** Pointer position inside the container as a percentage along the split axis. */
export function pointerPercent(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  direction: SplitDirection,
  textDirection: TextDirection,
): number {
  if (direction === "column") {
    return rect.height > 0 ? ((clientY - rect.top) / rect.height) * 100 : 0;
  }
  if (rect.width <= 0) return 0;
  const fromStart = textDirection === "rtl" ? rect.left + rect.width - clientX : clientX - rect.left;
  return (fromStart / rect.width) * 100;
}
