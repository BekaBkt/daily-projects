export interface ScaleConfig {
  /** Viewport width (px) where the scale sits at its minimum sizes. */
  minViewport: number;
  /** Viewport width (px) where the scale reaches its maximum sizes. */
  maxViewport: number;
  /** Size of step 0 at the min viewport (px). */
  minBase: number;
  /** Size of step 0 at the max viewport (px). */
  maxBase: number;
  minRatio: number;
  maxRatio: number;
  stepsDown: number;
  stepsUp: number;
  /** px per rem, used only when printing. */
  rootSize: number;
}

export type Unit = "rem" | "px";

export interface Step {
  step: number;
  /** Size at the min viewport (px). */
  min: number;
  /** Size at the max viewport (px). */
  max: number;
  /** Size grows by `slope` px per px of viewport width. */
  slope: number;
  /** Size (px) the line would have at a 0px viewport. */
  intercept: number;
}

export function buildStep(
  step: number,
  min: number,
  max: number,
  minViewport: number,
  maxViewport: number,
): Step {
  const slope = (max - min) / (maxViewport - minViewport);
  return { step, min, max, slope, intercept: min - slope * minViewport };
}

export function buildScale(config: ScaleConfig): Step[] {
  const steps: Step[] = [];
  for (let i = -config.stepsDown; i <= config.stepsUp; i++) {
    steps.push(
      buildStep(
        i,
        config.minBase * config.minRatio ** i,
        config.maxBase * config.maxRatio ** i,
        config.minViewport,
        config.maxViewport,
      ),
    );
  }
  return steps;
}

/** What the browser computes for the step's clamp() at a given viewport width (px). */
export function sizeAt(step: Step, width: number): number {
  const lo = Math.min(step.min, step.max);
  const hi = Math.max(step.min, step.max);
  return Math.min(hi, Math.max(lo, step.intercept + step.slope * width));
}

export function formatNumber(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function stepName(step: number): string {
  return `--step-${step}`;
}

/**
 * Builds `clamp(lo, b + m·vw, hi)`. The preferred value is written with the
 * positive term first, so a negative intercept reads `2vw - 0.5rem` instead of
 * `-0.5rem + 2vw`, and a zero intercept is dropped.
 */
export function toClamp(step: Step, unit: Unit, rootSize: number, precision = 4): string {
  const length = (px: number) =>
    unit === "rem" ? `${formatNumber(px / rootSize, precision)}rem` : `${formatNumber(px, precision)}px`;

  const lo = Math.min(step.min, step.max);
  const hi = Math.max(step.min, step.max);
  if (formatNumber(hi - lo, precision) === "0") return length(lo);

  const intercept = unit === "rem" ? step.intercept / rootSize : step.intercept;
  const terms = [
    { value: intercept, suffix: unit },
    { value: step.slope * 100, suffix: "vw" },
  ].filter((term) => formatNumber(term.value, precision) !== "0");
  terms.sort((a, b) => Number(b.value > 0) - Number(a.value > 0));

  const preferred = terms
    .map((term, i) => {
      const magnitude = `${formatNumber(Math.abs(term.value), precision)}${term.suffix}`;
      if (i === 0) return term.value < 0 ? `-${magnitude}` : magnitude;
      return `${term.value < 0 ? "-" : "+"} ${magnitude}`;
    })
    .join(" ");

  return `clamp(${length(lo)}, ${preferred}, ${length(hi)})`;
}

export function toCss(steps: Step[], unit: Unit, rootSize: number, precision = 4): string {
  const lines = [...steps]
    .reverse()
    .map((step) => `  ${stepName(step.step)}: ${toClamp(step, unit, rootSize, precision)};`);
  return `:root {\n${lines.join("\n")}\n}\n`;
}
