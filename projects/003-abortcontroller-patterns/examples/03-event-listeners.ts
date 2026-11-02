// 03 · One abort() removes many event listeners at once.
//
// Runs in Node (EventTarget is global), but the same code is how you'd wire
// pointermove/pointerup/keydown on `window` during a drag in the browser.

const log: string[] = [];
const target = new EventTarget();
const controller = new AbortController();
const { signal } = controller;

// No need to keep references to the handlers for removeEventListener.
target.addEventListener("move", () => log.push("move"), { signal });
target.addEventListener("move", () => log.push("move (2nd handler)"), { signal });
target.addEventListener("end", () => log.push("end"), { signal });

target.dispatchEvent(new Event("move"));
target.dispatchEvent(new Event("end"));
console.log("before abort:", log.splice(0));
// → [ 'move', 'move (2nd handler)', 'end' ]

controller.abort();
target.dispatchEvent(new Event("move"));
target.dispatchEvent(new Event("end"));
console.log("after abort:", log.splice(0)); // → []

// Adding a listener with an already-aborted signal is a silent no-op.
target.addEventListener("move", () => log.push("late"), { signal });
target.dispatchEvent(new Event("move"));
console.log("late listener:", log.splice(0)); // → []

// A real-world shape: start a "session" of listeners, end it with one call.
function startDrag(surface: EventTarget, onMove: (e: Event) => void): () => void {
  const session = new AbortController();
  surface.addEventListener("move", onMove, { signal: session.signal });
  surface.addEventListener("end", () => session.abort(), { signal: session.signal });
  surface.addEventListener("cancel", () => session.abort(), { signal: session.signal });
  return () => session.abort();
}

let moves = 0;
startDrag(target, () => moves++);
target.dispatchEvent(new Event("move"));
target.dispatchEvent(new Event("move"));
target.dispatchEvent(new Event("end")); // tears down all three listeners
target.dispatchEvent(new Event("move"));
console.log("moves counted:", moves); // → 2

export {};
