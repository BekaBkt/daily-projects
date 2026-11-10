// 04 · Browser APIs as external stores: media queries, network, tab visibility.
//
// Typecheck-only example (needs a browser). Each hook is a subscribe function
// plus a getSnapshot that returns a primitive, so stability comes for free.
// React resubscribes whenever `subscribe` changes identity, so module-level
// functions (or useCallback for parameterised ones) keep listeners attached once.
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  // A new getSnapshot each render is fine: React only re-reads it, it doesn't resubscribe.
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Server value is `true`: until we know, don't animate. */
export const usePrefersReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)", true);

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

/**
 * Poll only while someone can see the result and the network is up.
 * Returns whether polling is currently active.
 */
export function usePolling(callback: () => void, intervalMs: number): boolean {
  const visible = useDocumentVisible();
  const online = useOnlineStatus();
  const active = visible && online;

  // Latest callback without restarting the interval when it changes.
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (!active) return;
    latest.current(); // catch up straight away after coming back
    const id = window.setInterval(() => latest.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return active;
}

export function BuildStatus({ refresh }: { refresh: () => void }) {
  const polling = usePolling(refresh, 10_000);
  const online = useOnlineStatus();
  const reduceMotion = usePrefersReducedMotion();

  return (
    <p role="status" className="build-status">
      {/* The pulsing dot is decoration; the text carries the meaning. */}
      <span aria-hidden="true" className={polling && !reduceMotion ? "dot dot--pulse" : "dot"} />
      {!online ? "Offline: updates resume when you reconnect" : polling ? "Live, checking every 10 s" : "Paused while this tab is hidden"}
    </p>
  );
}
