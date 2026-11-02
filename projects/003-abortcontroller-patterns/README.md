# 003 · AbortController Beyond Fetch

**Type:** TIL · **Stack:** TypeScript, Node 22 (`tsx`), React 19 types · **Date:** 2026-11-02

`AbortController` is usually met as "the thing that cancels `fetch`", but it is really a general cancellation primitive for the whole platform. One signal can stop a request, remove a batch of event listeners, short-circuit a retry loop, and tell a React effect to ignore a stale response. These examples run offline against a tiny local server, so the timings and errors they print are real.

## Key points

- **`01-cancel-fetch.ts`**: `abort()` rejects with an `AbortError`, but `abort(reason)` rejects with *that reason*. Check `signal.aborted`, not `err.name`. The signal also covers the response body, not just the headers.
- **`02-timeout-and-any.ts`**: `AbortSignal.timeout(ms)` gives a `TimeoutError` with no timer to clear; `AbortSignal.any([user, timeout])` combines "cancel button or timeout" and keeps the reason of whichever fired first. An already-aborted signal rejects without opening a connection.
- **`03-event-listeners.ts`**: `addEventListener(type, fn, { signal })` lets one `abort()` remove every listener of a drag or modal "session", with no handler references kept around.
- **`04-make-it-abortable.ts`**: writing your own abortable `sleep` and `retry`: check `aborted` first, reject with `signal.reason`, and remove the abort listener on success so long-lived signals don't collect closures.
- **`05-use-json.tsx`**: a `useJson` hook where the effect cleanup aborts the request, and `signal.aborted` doubles as the "ignore this result" flag against race conditions and StrictMode's double-invoke. Loading state is derived from the last settled URL instead of stored.

## What I practiced

- **The abort reason is the error.** `fetch` and well-behaved APIs reject with `signal.reason`, so `if (signal.aborted)` is the only check that works for plain aborts, timeouts and custom reasons alike.
- **Composing signals instead of juggling timers.** `AbortSignal.timeout` + `AbortSignal.any` replace the `setTimeout`/`clearTimeout`/flag dance, and the `DOMException` name (`AbortError` vs `TimeoutError`) tells you which one won.
- **Cleanup goes both ways.** A function that accepts a signal must also detach from it when it finishes (`removeEventListener` or `{ once: true }` alone isn't enough on success), or every call leaks a listener onto a signal that may live for the whole page.

## Run

```bash
npm install
npm run examples   # runs 01–04 with tsx
npm run typecheck  # strict tsc over all five files, including the React hook
```
