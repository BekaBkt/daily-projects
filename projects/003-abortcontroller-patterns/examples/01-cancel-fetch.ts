// 01 · Cancelling a fetch, and what the rejection looks like.
import { startSlowServer } from "./_server";

const server = await startSlowServer();

// 1. Plain abort: fetch rejects with a DOMException named "AbortError".
const controller = new AbortController();
setTimeout(() => controller.abort(), 50);
try {
  await fetch(server.url(1000), { signal: controller.signal });
} catch (err) {
  console.log("1.", err instanceof DOMException, (err as DOMException).name);
  // → 1. true AbortError
}

// 2. Abort with a reason: fetch rejects with *that exact value*,
//    not an AbortError. Code that only checks `err.name === "AbortError"` misses it.
const withReason = new AbortController();
const reason = new Error("user navigated away");
setTimeout(() => withReason.abort(reason), 50);
try {
  await fetch(server.url(1000), { signal: withReason.signal });
} catch (err) {
  console.log("2.", err === reason, withReason.signal.reason === reason);
  // → 2. true true
}

// 3. So the robust check is the signal itself, not the error's shape.
const robust = new AbortController();
setTimeout(() => robust.abort("any value works as a reason"), 50);
try {
  await fetch(server.url(1000), { signal: robust.signal });
} catch (err) {
  if (robust.signal.aborted) console.log("3. cancelled on purpose:", robust.signal.reason);
  else throw err; // a real network error
}

// 4. Aborting after the response arrived is a harmless no-op...
const late = new AbortController();
const res = await fetch(server.url(10), { signal: late.signal });
const bodyPromise = res.json();
console.log("4.", await bodyPromise);
late.abort(); // nothing happens, the body was already read
// ...but aborting *between* headers and body rejects `res.json()` too,
// because the signal covers the whole response stream, not just the headers.

server.close();
