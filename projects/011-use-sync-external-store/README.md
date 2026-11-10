# 011 · useSyncExternalStore for Browser State

**Type:** TIL · **Stack:** TypeScript, React 19, Node 22 (`tsx`) · **Date:** 2026-11-10

Anything that lives outside React state (a module-level store, `matchMedia`, `navigator.onLine`, `localStorage`, `document.visibilityState`) used to mean `useState` + `useEffect` + a listener, which renders the wrong value first, can tear during concurrent rendering, and mismatches on hydration. `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` is React's built-in contract for this. These examples build a tiny store from scratch, show the two rules that trip people up (stable snapshots and the server snapshot), then use the same pattern for real browser APIs, a cross-tab `localStorage` hook, and a selector hook like the one inside Redux and Zustand.

## Key points

- **`_store.ts` + `01-tiny-store.ts`**: a store is `getSnapshot`, `subscribe` and an immutable `setState` that notifies only when `Object.is` says the value changed. Mutating in place and "setting" the same object updates the data but tells nobody.
- **`02-cached-snapshots.ts`**: `getSnapshot` must return the same value until the store changes. `filter()` or an object literal inside it allocates on every call, which React reads as "changed" and loops on. Primitives, the raw state, or a `memoizeOne` keyed on the state reference are all safe.
- **`03-server-snapshot.tsx`**: without the third argument, `renderToString` throws *"Missing getServerSnapshot"*. With it, the server renders a neutral placeholder and hydration swaps in the real value without a mismatch, and `window` is never touched on the server.
- **`04-browser-hooks.tsx`**: `useMediaQuery`, `usePrefersReducedMotion`, `useOnlineStatus` and `useDocumentVisible`, combined into a `usePolling` hook that pauses while the tab is hidden or offline and catches up when it comes back.
- **`05-local-storage.tsx`**: `useLocalStorage` that syncs every component in the tab (own listener set) and every other tab (`storage` event), validates what it reads, survives blocked storage, and drives an accessible radio-group theme setting.
- **`06-selectors.tsx`**: `useStoreSelector(store, selector, isEqual)`, so a "3 left" counter doesn't re-render on unrelated updates and a filtered list keeps its array reference when the same items come back.

## What I practiced

- **The snapshot is compared, not trusted.** React calls `getSnapshot` many times per render and compares results with `Object.is`, so I return primitives or memoize on the store's state reference; deriving inside `getSnapshot` without a cache is an infinite loop waiting to happen.
- **`subscribe` identity matters, `getSnapshot` identity doesn't.** React resubscribes when `subscribe` changes, so I keep it at module level or in `useCallback`, while an inline `getSnapshot` returning a primitive is fine.
- **Choose the server value that's safe to be wrong for one frame.** Unknown theme renders neutral, reduced motion defaults to `true`, online defaults to `true`, and storage defaults to the fallback, so the first paint never shows something misleading.

## Run

```bash
npm install
npm run examples   # runs 01–03 with tsx (03 renders on the server with react-dom/server)
npm run typecheck  # strict tsc over all examples, including the browser hooks in 04–06
```

04–06 need a browser: import the components into any React 19 app (for example a Vite scaffold like [001](../001-haunted-focus-timer)) and open the page in two tabs to watch `ThemeSetting` sync.
