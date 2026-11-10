// 03 · getServerSnapshot: what to render when there's no browser.
//
// On the server (and during hydration on the client) React can't call your
// getSnapshot — window, matchMedia and localStorage don't exist, or don't match
// what the server saw. The third argument tells React what the server rendered.
// During hydration React uses it first, then immediately re-renders with the
// real client value, so there's no hydration mismatch and no useEffect dance.
import { useSyncExternalStore } from "react";
import { renderToString } from "react-dom/server";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

// `null` = "unknown yet". Using a third state instead of guessing `false`
// lets the UI render something neutral rather than the wrong theme.
const getSnapshot = (): boolean | null => window.matchMedia(QUERY).matches;
const getServerSnapshot = (): boolean | null => null;

function ThemeLabelWithoutServerSnapshot() {
  const dark = useSyncExternalStore(subscribe, getSnapshot);
  return <p>Theme: {dark ? "dark" : "light"}</p>;
}

function ThemeLabel() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <p aria-busy={dark === null}>Theme: {dark === null ? "…" : dark ? "dark" : "light"}</p>;
}

try {
  renderToString(<ThemeLabelWithoutServerSnapshot />);
} catch (error) {
  console.log("✗", (error as Error).message);
}
// → ✗ Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.

console.log("✓", renderToString(<ThemeLabel />));
// → ✓ <p aria-busy="true">Theme: <!-- -->…</p>

// Neither subscribe nor getSnapshot ran above: the server never touches `window`.
// Rule of thumb for the server value: pick the one that's safe if it's wrong for
// a frame. Unknown theme → neutral; reduced motion → assume `true` (no animation);
// online status → assume `true` (don't flash an "offline" banner).
