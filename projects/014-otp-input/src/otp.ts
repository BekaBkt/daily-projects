/**
 * Pure editing rules for a segmented one-time code field.
 *
 * The value is always a compact string (no holes): deleting a character in the
 * middle shifts the rest left, exactly like a normal text field would. Every
 * edit returns the next value plus the slot that should receive focus.
 */

export type OtpKind = "numeric" | "alphanumeric";

export interface Edit {
  value: string;
  focus: number;
}

const DISALLOWED: Record<OtpKind, RegExp> = {
  numeric: /[^0-9]/g,
  alphanumeric: /[^0-9A-Z]/g,
};

/** Normalise any input (typed, pasted, autofilled) to the allowed characters. */
export function sanitize(text: string, kind: OtpKind): string {
  // NFKC folds full-width digits ("４２８") from some IMEs into ASCII.
  const normalised = text.normalize("NFKC");
  const cased = kind === "alphanumeric" ? normalised.toUpperCase() : normalised;
  return cased.replace(DISALLOWED[kind], "");
}

/** The furthest slot a user may focus: the first empty one, or the last slot. */
export function maxFocus(value: string, length: number): number {
  return Math.min(value.length, length - 1);
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/**
 * Write `chars` starting at `index`, overwriting what is there.
 * A string at least as long as the code replaces it entirely, because people
 * paste the full code no matter which box has focus.
 */
export function insertAt(value: string, index: number, chars: string, length: number): Edit {
  if (chars.length === 0) return { value, focus: index };
  if (chars.length >= length) {
    const next = chars.slice(0, length);
    return { value: next, focus: length - 1 };
  }
  const at = clamp(index, 0, value.length);
  const next = (value.slice(0, at) + chars + value.slice(at + chars.length)).slice(0, length);
  return { value: next, focus: clamp(at + chars.length, 0, maxFocus(next, length)) };
}

/** Delete: remove the character under the slot, keep focus where it is. */
export function deleteAt(value: string, index: number, length: number): Edit {
  const next = value.slice(0, index) + value.slice(index + 1);
  return { value: next, focus: clamp(index, 0, maxFocus(next, length)) };
}

/**
 * Backspace: on a filled slot, clear it and stay; on the empty slot after the
 * last character, step back and clear the previous one.
 */
export function backspaceAt(value: string, index: number, length: number): Edit {
  if (index < value.length) return deleteAt(value, index, length);
  if (index === 0) return { value, focus: 0 };
  return deleteAt(value, index - 1, length);
}

/**
 * Work out what was typed into a single-character input.
 * The browser hands us the input's whole new value: the old character plus the
 * new one on either side of the caret, or a full code from SMS autofill.
 */
export function extractTyped(raw: string, previous: string, length: number): string {
  // Autofill replaces the value with the full code; keep it whole.
  // (A one-character slot plus a keystroke is two characters, hence `> 2`.)
  if (length > 2 && raw.length === length) return raw;
  if (previous && raw.length > previous.length) {
    if (raw.startsWith(previous)) return raw.slice(previous.length);
    if (raw.endsWith(previous)) return raw.slice(0, raw.length - previous.length);
  }
  return raw;
}
