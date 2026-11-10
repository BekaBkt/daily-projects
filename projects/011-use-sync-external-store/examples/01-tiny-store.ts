// 01 · An external store is three functions: read, subscribe, write.
//
// useSyncExternalStore(subscribe, getSnapshot) is the contract React needs from
// anything that lives outside React state: "call me when something changed" and
// "give me the current value". React compares snapshots with Object.is, so the
// store has to treat state as immutable and hand out a new reference on change.
import { createStore } from "./_store";

type Cart = { items: readonly string[]; coupon: string | null };

const cart = createStore<Cart>({ items: [], coupon: null });

let notifications = 0;
const unsubscribe = cart.subscribe(() => {
  notifications++;
  console.log("notify →", JSON.stringify(cart.getSnapshot()));
});

cart.setState((s) => ({ ...s, items: [...s.items, "keyboard"] }));
// → notify → {"items":["keyboard"],"coupon":null}

cart.setState((s) => ({ ...s, coupon: "WELCOME10" }));
// → notify → {"items":["keyboard"],"coupon":"WELCOME10"}

// Returning the same reference is a no-op: nothing to re-render.
cart.setState((s) => s);

// The classic bug: mutate in place, then "set" the same object.
// Object.is(prev, next) is true, so subscribers are never told. In React this
// is the component that "doesn't update until something else re-renders it".
const snapshot = cart.getSnapshot();
(snapshot.items as string[]).push("mouse");
cart.setState(snapshot);

console.log("notifications:", notifications); // → notifications: 2
console.log("items in store:", cart.getSnapshot().items.join(", "));
// → items in store: keyboard, mouse   (the data changed, nobody was told)

// Cleanup returned by subscribe is what React calls on unmount.
unsubscribe();
cart.setState((s) => ({ ...s, coupon: null }));
console.log("after unsubscribe:", notifications); // → after unsubscribe: 2
