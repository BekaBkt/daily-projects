/**
 * A small parser for classic 5-field cron expressions:
 *
 *   minute  hour  day-of-month  month  day-of-week
 *
 * Supports `*`, lists (`1,15`), ranges (`1-5`), steps (`*\/15`, `9-17/2`, `5/10`),
 * month and weekday names (`JAN`, `mon-fri`), `7` as Sunday, and the
 * `@hourly` / `@daily` / `@weekly` / `@monthly` / `@yearly` macros.
 */

export type FieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

export const FIELD_ORDER: readonly FieldName[] = [
  "minute",
  "hour",
  "dayOfMonth",
  "month",
  "dayOfWeek",
];

export const FIELD_LABELS: Record<FieldName, string> = {
  minute: "Minute",
  hour: "Hour",
  dayOfMonth: "Day of month",
  month: "Month",
  dayOfWeek: "Day of week",
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

interface FieldSpec {
  min: number;
  max: number;
  aliases?: readonly string[];
  /** Index offset of aliases[0] (months start at 1, weekdays at 0). */
  aliasBase?: number;
}

const SPECS: Record<FieldName, FieldSpec> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: {
    min: 1,
    max: 12,
    aliases: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    aliasBase: 1,
  },
  // 7 is accepted as Sunday and folded to 0 after expansion.
  dayOfWeek: {
    min: 0,
    max: 7,
    aliases: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
    aliasBase: 0,
  },
};

/** One comma-separated piece of a field, e.g. `9-17/2`. */
export interface Part {
  /** True when the piece started with `*`. */
  star: boolean;
  start: number;
  end: number;
  step: number;
  /** True for `a/n` (no explicit end): runs from `a` to the field max. */
  openEnded: boolean;
}

export interface Field {
  name: FieldName;
  source: string;
  parts: Part[];
  /** Sorted, de-duplicated values the field matches. */
  values: number[];
  /** Plain `*` (or an equivalent full range with step 1). */
  any: boolean;
}

export type Schedule = Record<FieldName, Field>;

export type ParseResult =
  | { ok: true; schedule: Schedule }
  | { ok: false; error: string; field?: FieldName };

export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

class FieldError extends Error {}

function parseValue(raw: string, spec: FieldSpec): number {
  const upper = raw.toUpperCase();
  if (spec.aliases) {
    const index = spec.aliases.indexOf(upper);
    if (index !== -1) return index + (spec.aliasBase ?? 0);
  }
  if (!/^\d+$/.test(raw)) {
    throw new FieldError(`"${raw}" is not a number${spec.aliases ? " or a name" : ""}`);
  }
  const value = Number(raw);
  if (value < spec.min || value > spec.max) {
    throw new FieldError(`${value} is outside ${spec.min}–${spec.max}`);
  }
  return value;
}

function parsePart(raw: string, spec: FieldSpec): Part {
  if (raw === "") throw new FieldError("empty list item");

  const [rangeText, stepText, extra] = raw.split("/");
  if (extra !== undefined) throw new FieldError(`"${raw}" has more than one "/"`);

  let step = 1;
  if (stepText !== undefined) {
    if (!/^\d+$/.test(stepText) || Number(stepText) === 0) {
      throw new FieldError(`step "${stepText}" must be a positive whole number`);
    }
    step = Number(stepText);
  }

  if (rangeText === "*") {
    return { star: true, start: spec.min, end: spec.max, step, openEnded: false };
  }

  const bounds = rangeText.split("-");
  if (bounds.length > 2) throw new FieldError(`"${rangeText}" is not a valid range`);

  const start = parseValue(bounds[0], spec);
  if (bounds.length === 2) {
    const end = parseValue(bounds[1], spec);
    if (end < start) throw new FieldError(`range ${bounds[0]}-${bounds[1]} runs backwards`);
    return { star: false, start, end, step, openEnded: false };
  }

  // `5/10` means "from 5, every 10" up to the field max.
  if (stepText !== undefined) {
    return { star: false, start, end: spec.max, step, openEnded: true };
  }
  return { star: false, start, end: start, step: 1, openEnded: false };
}

function parseField(name: FieldName, source: string): Field {
  const spec = SPECS[name];
  const parts = source.split(",").map((piece) => parsePart(piece, spec));

  const set = new Set<number>();
  for (const part of parts) {
    for (let v = part.start; v <= part.end; v += part.step) {
      set.add(name === "dayOfWeek" && v === 7 ? 0 : v);
    }
  }
  const values = [...set].sort((a, b) => a - b);
  const fullSize = name === "dayOfWeek" ? 7 : spec.max - spec.min + 1;

  return {
    name,
    source,
    parts,
    values,
    any: parts.some((p) => p.star && p.step === 1) || values.length === fullSize,
  };
}

export function parseCron(input: string): ParseResult {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, error: "Enter a cron expression." };

  const expanded = trimmed.startsWith("@") ? MACROS[trimmed.toLowerCase()] : trimmed;
  if (expanded === undefined) {
    return { ok: false, error: `Unknown macro "${trimmed}".` };
  }

  const tokens = expanded.split(/\s+/);
  if (tokens.length !== 5) {
    return {
      ok: false,
      error: `Expected 5 fields (minute hour day month weekday), got ${tokens.length}.`,
    };
  }

  const schedule = {} as Schedule;
  for (const [i, name] of FIELD_ORDER.entries()) {
    try {
      schedule[name] = parseField(name, tokens[i]);
    } catch (err) {
      if (err instanceof FieldError) {
        return { ok: false, error: `${FIELD_LABELS[name]}: ${err.message}.`, field: name };
      }
      throw err;
    }
  }
  return { ok: true, schedule };
}
