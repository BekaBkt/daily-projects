// 04 · Making your own async functions accept a signal.
//
// Three rules: check `aborted` up front, reject with `signal.reason`,
// and remove the abort listener when the work finishes so it can't leak.
import { getEventListeners } from "node:events";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
}

/** Retries `task` with exponential backoff. Aborting stops both the task and the wait. */
async function retry<T>(
  task: (signal: AbortSignal, attempt: number) => Promise<T>,
  { attempts = 3, baseDelayMs = 100, signal = new AbortController().signal }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await task(signal, attempt);
    } catch (err) {
      if (signal.aborted || attempt >= attempts) throw err;
      await sleep(baseDelayMs * 2 ** (attempt - 1), signal);
    }
  }
}

// Demo 1: a flaky task that succeeds on the 3rd try.
const result = await retry(
  async (_signal, attempt) => {
    console.log(`  attempt ${attempt}`);
    if (attempt < 3) throw new Error("flaky");
    return "done";
  },
  { attempts: 5, baseDelayMs: 20 },
);
console.log("1.", result);

// Demo 2: abort while waiting in the backoff; it rejects right away
// with our reason instead of sleeping out the remaining delay.
const controller = new AbortController();
setTimeout(() => controller.abort(new Error("gave up")), 150);
const t0 = performance.now();
try {
  await retry(
    async () => {
      throw new Error("always fails");
    },
    { attempts: 10, baseDelayMs: 100, signal: controller.signal },
  );
} catch (err) {
  console.log("2.", (err as Error).message, `after ~${Math.round(performance.now() - t0)}ms`);
  // → 2. gave up after ~150ms (instead of 100 + 200 + 400 + ...)
}

// Demo 3: no listener leak. After 50 sleeps on one long-lived signal, nothing is
// still attached to it. Without the removeEventListener in `sleep`, this would
// print 50: every finished sleep would keep its closure alive until the signal dies.
const longLived = new AbortController();
for (let i = 0; i < 50; i++) await sleep(0, longLived.signal);
console.log("3. abort listeners left:", getEventListeners(longLived.signal, "abort").length);
// → 3. abort listeners left: 0

export {};
