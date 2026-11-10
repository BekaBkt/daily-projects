// The smallest useful external store: a value, a set of listeners, and a setter
// that only notifies when the value actually changed (by reference).

export type Listener = () => void;
export type Updater<T> = T | ((prev: T) => T);

export interface Store<T> {
  getSnapshot: () => T;
  subscribe: (listener: Listener) => () => void;
  setState: (next: Updater<T>) => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    // Arrow functions so they can be passed around unbound,
    // e.g. useSyncExternalStore(store.subscribe, store.getSnapshot).
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setState: (next) => {
      // Note: a store whose T is itself a function can't use this shorthand.
      const value = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      // Iterating a Set is safe even if a listener unsubscribes mid-loop.
      for (const listener of listeners) listener();
    },
  };
}
