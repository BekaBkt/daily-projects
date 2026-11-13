/** Control points of a CSS `cubic-bezier(x1, y1, x2, y2)`. P0 is (0, 0) and P3 is (1, 1). */
export type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

/** Vertical range the editor shows, so overshooting curves (back, elastic-ish) still fit. */
export const Y_MIN = -0.6;
export const Y_MAX = 1.6;

const EPSILON = 1e-6;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Rounds and turns -0 into 0 so it never shows up as "-0" in the output. */
export const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor || 0;
};

/** x has to stay in [0, 1] for the curve to be a function of time; y only has to fit the editor. */
export function normalize([x1, y1, x2, y2]: Bezier): Bezier {
  return [
    round(clamp(x1, 0, 1)),
    round(clamp(y1, Y_MIN, Y_MAX)),
    round(clamp(x2, 0, 1)),
    round(clamp(y2, Y_MIN, Y_MAX)),
  ];
}

/**
 * Builds y = f(x) for the curve, the same way browsers evaluate `cubic-bezier()`.
 *
 * The curve is parametric: x(t) and y(t). Progress through the animation is x, so to
 * get the eased value we first find t with x(t) = x, then return y(t). x(t) is a cubic
 * with no closed form worth using, so: Newton–Raphson from t = x (converges in 2–4 steps
 * for normal curves), and bisection as a fallback when the slope gets too flat.
 */
export function createEasing([x1, y1, x2, y2]: Bezier): (x: number) => number {
  // Polynomial form of B(t) = 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³, written as ((a·t + b)·t + c)·t.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveT = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < EPSILON) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < EPSILON) break;
      t -= error / slope;
    }

    // x(t) is monotonic on [0, 1] because x1 and x2 are clamped to [0, 1], so bisection always works.
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > EPSILON) {
      const value = sampleX(t);
      if (Math.abs(value - x) < EPSILON) return t;
      if (value < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return sampleY(solveT(x));
  };
}

/** The same timing played backwards: ease-in becomes ease-out and vice versa. */
export const reverse = ([x1, y1, x2, y2]: Bezier): Bezier =>
  normalize([1 - x2, 1 - y2, 1 - x1, 1 - y1]);

export const sameCurve = (a: Bezier, b: Bezier) => a.every((v, i) => round(v) === round(b[i]));

export const KEYWORDS: Record<string, Bezier> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

export const keywordFor = (curve: Bezier) =>
  Object.keys(KEYWORDS).find((name) => sameCurve(KEYWORDS[name], curve));

export const format = (curve: Bezier) => `cubic-bezier(${curve.map((v) => round(v)).join(", ")})`;

export type ParseResult = { ok: true; value: Bezier } | { ok: false; error: string };

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/**
 * Accepts `cubic-bezier(.25, .1, .25, 1)`, a bare list like `0.25 0.1 0.25 1`,
 * or one of the CSS keywords. Errors say which number is wrong.
 */
export function parse(input: string): ParseResult {
  const text = input.trim().toLowerCase().replace(/;$/, "");
  if (text === "") return { ok: false, error: "Enter a cubic-bezier() or a keyword like ease-out." };
  if (Object.hasOwn(KEYWORDS, text)) return { ok: true, value: KEYWORDS[text] };

  const inner = text.match(/^cubic-bezier\((.*)\)$/)?.[1] ?? text;
  const parts = inner.split(/\s*,\s*|\s+/).filter(Boolean);
  if (parts.length !== 4) {
    return { ok: false, error: `Expected 4 numbers, got ${parts.length}.` };
  }

  const names = ["x1", "y1", "x2", "y2"];
  const values: number[] = [];
  for (const [i, part] of parts.entries()) {
    if (!NUMBER.test(part)) return { ok: false, error: `${names[i]}: "${part}" is not a number.` };
    const value = Number(part);
    if (i % 2 === 0 && (value < 0 || value > 1)) {
      return { ok: false, error: `${names[i]}: ${value} is outside 0–1. x values must stay in that range.` };
    }
    if (i % 2 === 1 && (value < Y_MIN || value > Y_MAX)) {
      return { ok: false, error: `${names[i]}: ${value} is outside the editor's ${Y_MIN} to ${Y_MAX} range.` };
    }
    values.push(value);
  }

  const [x1, y1, x2, y2] = values;
  return { ok: true, value: [x1, y1, x2, y2] };
}
