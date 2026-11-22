import type { ScaleConfig, Unit } from "./fluid";

export type Field = keyof ScaleConfig;

/** The form keeps raw strings so a half-typed "1." doesn't get reformatted under the caret. */
export type Draft = Record<Field, string> & { unit: Unit };

export const DEFAULT_DRAFT: Draft = {
  minViewport: "360",
  maxViewport: "1280",
  minBase: "16",
  maxBase: "19",
  minRatio: "1.2",
  maxRatio: "1.25",
  stepsDown: "2",
  stepsUp: "5",
  rootSize: "16",
  unit: "rem",
};

interface Rule {
  min: number;
  max: number;
  integer?: boolean;
}

const RULES: Record<Field, Rule> = {
  minViewport: { min: 200, max: 4000 },
  maxViewport: { min: 200, max: 4000 },
  minBase: { min: 8, max: 64 },
  maxBase: { min: 8, max: 64 },
  minRatio: { min: 1, max: 2 },
  maxRatio: { min: 1, max: 2 },
  stepsDown: { min: 0, max: 4, integer: true },
  stepsUp: { min: 0, max: 8, integer: true },
  rootSize: { min: 8, max: 32 },
};

export const FIELDS = Object.keys(RULES) as Field[];

export const RATIO_PRESETS: readonly { label: string; value: number }[] = [
  { label: "Minor second", value: 1.067 },
  { label: "Major second", value: 1.125 },
  { label: "Minor third", value: 1.2 },
  { label: "Major third", value: 1.25 },
  { label: "Perfect fourth", value: 1.333 },
  { label: "Augmented fourth", value: 1.414 },
  { label: "Perfect fifth", value: 1.5 },
  { label: "Golden ratio", value: 1.618 },
];

export type ParseResult =
  | { ok: true; config: ScaleConfig }
  | { ok: false; errors: Partial<Record<Field, string>> };

export function parseDraft(draft: Draft): ParseResult {
  const errors: Partial<Record<Field, string>> = {};
  const config = {} as ScaleConfig;

  for (const field of FIELDS) {
    const raw = draft[field].trim();
    const value = Number(raw);
    const rule = RULES[field];
    if (raw === "" || !Number.isFinite(value)) {
      errors[field] = "Enter a number.";
    } else if (rule.integer && !Number.isInteger(value)) {
      errors[field] = "Enter a whole number.";
    } else if (value < rule.min || value > rule.max) {
      errors[field] = `Use ${rule.min} to ${rule.max}.`;
    } else {
      config[field] = value;
    }
  }

  if (!errors.minViewport && !errors.maxViewport && config.maxViewport <= config.minViewport) {
    errors.maxViewport = "Must be wider than the min viewport.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, config };
}

/** Settings live in the hash so a scale can be shared as a link. */
export function draftToHash(draft: Draft): string {
  return new URLSearchParams(Object.entries(draft)).toString();
}

export function draftFromHash(hash: string): Draft {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const draft: Draft = { ...DEFAULT_DRAFT };
  for (const field of FIELDS) {
    const value = params.get(field);
    if (value !== null) draft[field] = value;
  }
  const unit = params.get("unit");
  if (unit === "rem" || unit === "px") draft.unit = unit;
  return draft;
}
