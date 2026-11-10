// 06 · Subscribing to a slice of a store with a selector.
//
// Typecheck-only example. A component that only shows "3 left" shouldn't
// re-render when a todo's title changes. Running the selector inside
// getSnapshot does that, but (see 02) the result must be stable: we memoize on
// the store snapshot, and let the caller pass `isEqual` so a selector that
// builds a fresh array can still hand back the previous reference.
// This is roughly what `use-sync-external-store/with-selector` (used by Redux
// and Zustand) does, in ~30 lines.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { createStore, type Store } from "./_store";

export function useStoreSelector<T, S>(
  store: Store<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  // The last selection React committed, so a new selector (e.g. an inline
  // arrow on every render) can still reuse an equal previous result.
  const committed = useRef<{ selection: S } | null>(null);

  const getSelection = useMemo(() => {
    let memo: { state: T; selection: S } | null = null;
    return () => {
      const state = store.getSnapshot();
      if (memo !== null && Object.is(memo.state, state)) return memo.selection;
      let selection = selector(state);
      const previous = memo ?? committed.current;
      if (previous !== null && isEqual(previous.selection, selection)) selection = previous.selection;
      memo = { state, selection };
      return selection;
    };
  }, [store, selector, isEqual]);

  // Same function for the server snapshot: an in-memory store has no browser dependency.
  const selection = useSyncExternalStore(store.subscribe, getSelection, getSelection);

  useEffect(() => {
    committed.current = { selection };
  }, [selection]);

  return selection;
}

export function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
}

// --- demo -------------------------------------------------------------------

type Todo = { id: number; title: string; done: boolean };
type TodoState = { todos: readonly Todo[]; filter: "all" | "open" };

export const todoStore = createStore<TodoState>({
  todos: [
    { id: 1, title: "Read the React docs on useSyncExternalStore", done: true },
    { id: 2, title: "Write a tiny store", done: false },
    { id: 3, title: "Add a selector hook", done: false },
  ],
  filter: "all",
});

const toggle = (id: number) =>
  todoStore.setState((s) => ({
    ...s,
    todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  }));

// Module-level selectors are stable, so getSelection is created once.
const selectOpenCount = (s: TodoState) => s.todos.filter((t) => !t.done).length;
const selectVisible = (s: TodoState) => (s.filter === "open" ? s.todos.filter((t) => !t.done) : s.todos);

// Re-renders only when the number changes, not on every store update (switching the filter, say).
export function OpenCount() {
  const open = useStoreSelector(todoStore, selectOpenCount);
  return (
    <p role="status">
      {open === 0 ? "All done" : `${open} left`}
    </p>
  );
}

export function TodoList() {
  // filter() returns a new array every time; shallowArrayEqual keeps the old
  // reference when the same todo objects come back, e.g. after an unrelated update.
  const visible = useStoreSelector(todoStore, selectVisible, shallowArrayEqual);
  const filter = useStoreSelector(todoStore, (s) => s.filter); // inline is fine for primitives

  return (
    <section aria-labelledby="todos-heading">
      <h2 id="todos-heading">Todos</h2>
      <label>
        <input
          type="checkbox"
          checked={filter === "open"}
          onChange={(e) =>
            todoStore.setState((s) => ({ ...s, filter: e.currentTarget.checked ? "open" : "all" }))
          }
        />
        Hide completed
      </label>
      <ul>
        {visible.map((todo) => (
          <li key={todo.id}>
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} />
              {todo.title}
            </label>
          </li>
        ))}
      </ul>
      <OpenCount />
    </section>
  );
}
