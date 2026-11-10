// 02 · getSnapshot must return the same value until the store changes.
//
// React calls getSnapshot on every render (twice in dev, to check it's stable)
// and again after commit to catch updates that slipped in during rendering. If
// two calls return values that aren't Object.is-equal, React concludes the store
// changed and renders again — forever. In dev you get "The result of getSnapshot
// should be cached to avoid an infinite loop", then "Maximum update depth exceeded".
import { createStore } from "./_store";

type Todo = { id: number; title: string; done: boolean };

const todos = createStore<readonly Todo[]>([
  { id: 1, title: "Write the store", done: true },
  { id: 2, title: "Subscribe from React", done: false },
  { id: 3, title: "Handle SSR", done: false },
]);

function check(label: string, getSnapshot: () => unknown) {
  const a = getSnapshot();
  const b = getSnapshot();
  console.log(label.padEnd(30), Object.is(a, b) ? "✓ stable" : "✗ new value on every call");
}

// ✗ Deriving inside getSnapshot: filter/map/spread always allocate.
check("filter in getSnapshot", () => todos.getSnapshot().filter((t) => !t.done));
// → filter in getSnapshot          ✗ new value on every call
check("object literal in getSnapshot", () => ({ total: todos.getSnapshot().length }));
// → object literal in getSnapshot  ✗ new value on every call

// ✓ The raw state reference, or a primitive derived from it.
check("raw state", todos.getSnapshot);
// → raw state                      ✓ stable
check("primitive (count)", () => todos.getSnapshot().filter((t) => !t.done).length);
// → primitive (count)              ✓ stable

// ✓ Derived objects are fine if they're memoized on the input reference.
function memoizeOne<I, O>(fn: (input: I) => O): (input: I) => O {
  let cache: { input: I; output: O } | undefined;
  return (input) => {
    if (cache === undefined || !Object.is(cache.input, input)) {
      cache = { input, output: fn(input) };
    }
    return cache.output;
  };
}

const selectOpen = memoizeOne((list: readonly Todo[]) => list.filter((t) => !t.done));
const getOpenTodos = () => selectOpen(todos.getSnapshot());
check("memoized on input", getOpenTodos);
// → memoized on input              ✓ stable

// The memo still invalidates when the store really changes:
const before = getOpenTodos();
todos.setState((list) => list.map((t) => (t.id === 2 ? { ...t, done: true } : t)));
const after = getOpenTodos();
console.log("after toggling #2:", Object.is(before, after) ? "same" : "new", after.map((t) => t.title));
// → after toggling #2: new [ 'Handle SSR' ]

