// 05 · localStorage that stays in sync across components *and* tabs.
//
// Typecheck-only example (needs a browser). The `storage` event only fires in
// *other* tabs, so same-tab writes notify our own listener set. The trick that
// keeps it cheap: the snapshot is the raw string, not the parsed object. Strings
// compare by value under Object.is, so a write to "theme" doesn't re-render a
// component reading "sidebar", and parsing happens once per actual change.
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

const sameTabListeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  sameTabListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    sameTabListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage disabled, sandboxed iframe, etc.
  }
}

function writeRaw(key: string, raw: string | null) {
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
  } catch {
    // Quota exceeded or storage blocked: listeners re-read and see the old value.
  }
  for (const listener of sameTabListeners) listener();
}

function decode<T>(raw: string | null, fallback: T, isValid: (value: unknown) => value is T): T {
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Another tab, an older app version or a person in devtools may have written it.
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, fallback: T, isValid: (value: unknown) => value is T) {
  // Like useState's initial value: read once, so inline literals don't break memoization.
  const [options] = useState(() => ({ fallback, isValid }));

  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );

  const value = useMemo(() => decode(raw, options.fallback, options.isValid), [raw, options]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      // Read the *current* stored value, not the one from the last render,
      // so two quick updates don't overwrite each other.
      const prev = decode(readRaw(key), options.fallback, options.isValid);
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key, options],
  );

  const remove = useCallback(() => writeRaw(key, null), [key]);

  return [value, setValue, remove] as const;
}

type Theme = "system" | "light" | "dark";
const THEMES = ["system", "light", "dark"] as const satisfies readonly Theme[];
const isTheme = (value: unknown): value is Theme => THEMES.some((t) => t === value);

// Open the page in two tabs: changing the radio in one updates the other.
export function ThemeSetting() {
  const [theme, setTheme, resetTheme] = useLocalStorage<Theme>("theme", "system", isTheme);

  return (
    <fieldset>
      <legend>Theme</legend>
      {THEMES.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="theme"
            value={option}
            checked={theme === option}
            onChange={() => setTheme(option)}
          />
          {option[0].toUpperCase() + option.slice(1)}
        </label>
      ))}
      <button type="button" onClick={resetTheme} disabled={theme === "system"}>
        Reset to default
      </button>
    </fieldset>
  );
}
