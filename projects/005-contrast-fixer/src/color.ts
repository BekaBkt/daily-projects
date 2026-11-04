/** sRGB channels in the 0–1 range. */
export type RGB = { r: number; g: number; b: number };

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Parses `#rgb` or `#rrggbb` (the `#` is optional). Returns null for anything else. */
export function parseHex(input: string): RGB | null {
  const match = HEX_RE.exec(input.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  const n = parseInt(hex, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function toHex({ r, g, b }: RGB): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Normalises user input to lowercase `#rrggbb`, or null if invalid. */
export function normalizeHex(input: string): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, from 1 to 21. Order of arguments does not matter. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * WCAG says a ratio must not be rounded up to pass (4.499 fails AA),
 * so we truncate for display instead of rounding.
 */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

export type Level = { id: string; label: string; min: number };

export const LEVELS: Level[] = [
  { id: "aa", label: "AA · normal text", min: 4.5 },
  { id: "aa-large", label: "AA · large text", min: 3 },
  { id: "aaa", label: "AAA · normal text", min: 7 },
  { id: "aaa-large", label: "AAA · large text", min: 4.5 },
  { id: "ui", label: "UI components & icons", min: 3 },
];

/* ---------- OKLCH ---------- */

export type OKLCH = { l: number; c: number; h: number };

export function rgbToOklch(rgb: RGB): OKLCH {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

/** Converts back to sRGB. Out-of-gamut channels are clipped by `toHex`. */
export function oklchToRgb({ l, c, h }: OKLCH): RGB {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l3 = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m3 = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s3 = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    r: toGamma(clamp(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3)),
    g: toGamma(clamp(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3)),
    b: toGamma(clamp(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)),
  };
}

export type Fix = { hex: string; ratio: number; deltaL: number };

/**
 * Finds the colour closest to `fg` (same OKLCH hue and chroma, only lightness changes)
 * that reaches `target` contrast against `bg`. Walks lightness up and down in small
 * steps, checks the real hex value at each step and keeps the smaller change.
 * Returns null when `fg` already passes.
 */
export function suggestFix(fg: RGB, bg: RGB, target: number, step = 0.0025): Fix | null {
  if (contrastRatio(fg, bg) >= target) return null;
  const start = rgbToOklch(fg);
  let best: Fix | null = null;

  for (const dir of [1, -1]) {
    for (let l = start.l + dir * step; l >= 0 && l <= 1; l += dir * step) {
      const hex = toHex(oklchToRgb({ ...start, l }));
      const ratio = contrastRatio(parseHex(hex)!, bg);
      if (ratio >= target) {
        const deltaL = Math.abs(l - start.l);
        if (!best || deltaL < best.deltaL) best = { hex, ratio, deltaL };
        break;
      }
    }
  }

  // Pure black or white is always a valid last resort if chroma kept us out of reach.
  if (!best) {
    for (const hex of ["#000000", "#ffffff"]) {
      const ratio = contrastRatio(parseHex(hex)!, bg);
      if (ratio >= target && (!best || ratio > best.ratio)) best = { hex, ratio, deltaL: 1 };
    }
  }
  return best;
}
