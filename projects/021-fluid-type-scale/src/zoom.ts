import { sizeAt, type Step } from "./fluid";

/** WCAG 1.4.4: text can be resized up to 200%. */
export const REQUIRED_GAIN = 2;
/** Highest page zoom in Chrome, Firefox and Safari. */
export const MAX_ZOOM = 5;

/** Window widths (CSS px at 100%) we check, from a small phone to a wide desktop. */
export const CHECKED_WIDTHS: readonly number[] = Array.from(
  { length: (2560 - 320) / 16 + 1 },
  (_, i) => 320 + i * 16,
);

const ZOOM_LEVELS: readonly number[] = Array.from(
  { length: Math.round((MAX_ZOOM - 1) / 0.05) + 1 },
  (_, i) => 1 + i * 0.05,
);

/**
 * How much bigger the text renders at `zoom` than at 100%, in a window that is
 * `width` CSS px wide at 100%.
 *
 * Page zoom shrinks the layout viewport to `width / zoom` CSS px and scales
 * every CSS px by `zoom`. The rem/px parts of the clamp follow the zoom, the
 * vw part is measured against the now narrower viewport, so it doesn't.
 */
export function zoomGain(step: Step, width: number, zoom: number): number {
  return (zoom * sizeAt(step, width / zoom)) / sizeAt(step, width);
}

export interface ZoomCheck {
  /** Best gain the user can reach at the worst window width. */
  gain: number;
  /** The window width where that worst case happens. */
  width: number;
  passes: boolean;
}

/**
 * For every window width, find the best gain any zoom level up to 500% gives,
 * then report the width where that best is lowest. If it's under 2× there is
 * a window size where the user can't make this step twice as big.
 */
export function checkZoom(step: Step, widths: readonly number[] = CHECKED_WIDTHS): ZoomCheck {
  let worst: ZoomCheck = { gain: Infinity, width: widths[0] ?? 0, passes: true };
  for (const width of widths) {
    let best = 0;
    for (const zoom of ZOOM_LEVELS) best = Math.max(best, zoomGain(step, width, zoom));
    if (best < worst.gain) worst = { gain: best, width, passes: true };
  }
  worst.passes = worst.gain >= REQUIRED_GAIN - 1e-9;
  return worst;
}
