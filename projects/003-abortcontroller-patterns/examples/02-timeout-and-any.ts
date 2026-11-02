// 02 · AbortSignal.timeout() and AbortSignal.any() replace hand-rolled timers.
import { startSlowServer } from "./_server";

const server = await startSlowServer();

function nameOf(err: unknown): string {
  return err instanceof DOMException ? err.name : String(err);
}

// 1. Timeout without a controller or a setTimeout to clean up.
//    The error is a "TimeoutError", so you can tell it apart from a user cancel.
try {
  await fetch(server.url(500), { signal: AbortSignal.timeout(100) });
} catch (err) {
  console.log("1.", nameOf(err)); // → 1. TimeoutError
}

// 2. "Cancel button OR 1s timeout, whichever comes first".
//    The combined signal takes the reason of whichever input aborted first.
async function load(delay: number, userSignal: AbortSignal) {
  const signal = AbortSignal.any([userSignal, AbortSignal.timeout(1000)]);
  try {
    const res = await fetch(server.url(delay), { signal });
    return `ok ${JSON.stringify(await res.json())}`;
  } catch (err) {
    if (!signal.aborted) throw err;
    return nameOf(signal.reason) === "TimeoutError" ? "timed out" : "cancelled by user";
  }
}

const user = new AbortController();
setTimeout(() => user.abort(), 50);
console.log("2a.", await load(800, user.signal)); // → cancelled by user
console.log("2b.", await load(1500, new AbortController().signal)); // → timed out
console.log("2c.", await load(20, new AbortController().signal)); // → ok {"delay":20}

// 3. A signal that is already aborted short-circuits: fetch rejects immediately
//    without opening a connection.
const t0 = performance.now();
try {
  await fetch(server.url(500), { signal: AbortSignal.abort() });
} catch (err) {
  console.log("3.", nameOf(err), `${Math.round(performance.now() - t0)}ms`);
}

server.close();
