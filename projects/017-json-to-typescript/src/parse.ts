import type { JsonValue } from "./infer";

export type ParseResult =
  | { ok: true; value: JsonValue }
  | { ok: false; message: string; line?: number; column?: number };

/**
 * JSON.parse with a location. Engines don't agree on error messages (and
 * Chromium often reports no position at all), so on failure a small
 * recursive-descent scanner walks the text and finds the first bad character.
 */
export function parseJson(text: string): ParseResult {
  if (!text.trim()) return { ok: false, message: "Paste some JSON to get started." };

  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw
      .replace(/^JSON\.parse: /, "")
      .replace(/, ".*" is not valid JSON$/s, "") // V8 echoes the whole input back
      .replace(/ (in JSON )?at position \d+.*$/s, "")
      .replace(/ at line \d+ column \d+.*$/s, "");

    const offset = findErrorOffset(text);
    if (offset === undefined) return { ok: false, message };

    const before = text.slice(0, offset).split("\n");
    return { ok: false, message, line: before.length, column: before[before.length - 1].length + 1 };
  }
}

class SyntaxAt {
  constructor(readonly offset: number) {}
}

/** Offset of the first character that makes `text` invalid JSON, or undefined if it's valid. */
export function findErrorOffset(text: string): number | undefined {
  let i = 0;
  const fail = (at = i): never => {
    throw new SyntaxAt(Math.min(at, text.length));
  };
  const skipSpace = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i++;
  };

  const string = () => {
    i++; // opening quote
    for (;;) {
      if (i >= text.length) fail();
      const char = text[i];
      if (char === '"') return void i++;
      if (char < " ") fail();
      if (char === "\\") {
        const escape = text[i + 1];
        if (escape === "u") {
          if (!/^[\da-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail(i + 2);
          i += 6;
        } else if (escape !== undefined && '"\\/bfnrt'.includes(escape)) {
          i += 2;
        } else {
          fail(i + 1);
        }
      } else {
        i++;
      }
    }
  };

  const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const number = () => {
    NUMBER.lastIndex = i;
    const match = NUMBER.exec(text);
    if (!match || match[0] === "-") fail();
    i += match![0].length;
  };

  const literal = (word: string) => {
    for (const char of word) {
      if (text[i] !== char) fail();
      i++;
    }
  };

  const list = (close: string, item: () => void) => {
    i++; // opening bracket
    skipSpace();
    if (text[i] === close) return void i++;
    for (;;) {
      skipSpace();
      item();
      skipSpace();
      if (text[i] === ",") i++;
      else if (text[i] === close) return void i++;
      else fail();
    }
  };

  const value = (): void => {
    skipSpace();
    const char = text[i];
    if (char === "{") {
      list("}", () => {
        if (text[i] !== '"') fail();
        string();
        skipSpace();
        if (text[i] !== ":") fail();
        i++;
        value();
      });
    } else if (char === "[") list("]", value);
    else if (char === '"') string();
    else if (char === "t") literal("true");
    else if (char === "f") literal("false");
    else if (char === "n") literal("null");
    else if (char === "-" || (char >= "0" && char <= "9")) number();
    else fail();
  };

  try {
    value();
    skipSpace();
    if (i < text.length) fail();
    return undefined;
  } catch (error) {
    if (error instanceof SyntaxAt) return error.offset;
    throw error;
  }
}
