// 06 · Stopping early: break, abort, and what the source hears.
//
// A streamed response keeps the connection (and the server's work) alive
// until it's fully read or cancelled. Leaving a for-await loop, aborting a
// signal and unmounting a component should all reach the source.
import { fakeResponse, sleep } from "./_fake-server";
import { readLines } from "./_streams";

const many = Array.from({ length: 100 }, (_, i) => `line ${i + 1}\n`);

// 1 · `break` calls the generator's return(), its finally cancels the reader,
// and the cancel travels back through both pipeThrough steps to the source.
{
  let pulled = 0;
  let cancelled = false;
  const response = fakeResponse(many, {
    onPull: () => pulled++,
    onCancel: () => (cancelled = true),
  });
  const firstThree: string[] = [];
  for await (const line of readLines(response)) {
    firstThree.push(line);
    if (firstThree.length === 3) break;
  }
  await sleep(0); // cancellation propagates through the pipes asynchronously
  console.log(firstThree, { pulled, cancelled });
  // → [ 'line 1', 'line 2', 'line 3' ] { pulled: <100, cancelled: true }
  // Backpressure kept the source from producing all 100 chunks up front.
}

// 2 · A deadline. AbortSignal.timeout rejects with a "TimeoutError", which is
// worth telling apart from a user-initiated "AbortError" in the UI.
{
  let cancelled = false;
  const slow = fakeResponse(many, { delayMs: 60, onCancel: () => (cancelled = true) });
  let received = 0;
  try {
    for await (const _line of readLines(slow, { signal: AbortSignal.timeout(200) })) received++;
  } catch (error) {
    // The cancel reaches the source once its in-flight pull settles.
    await sleep(100);
    console.log(`${(error as Error).name} after ${received} lines, source cancelled: ${cancelled}`);
  }
  // → TimeoutError after 3 lines, source cancelled: true
}

// 3 · Several reasons to stop, one signal. This is the shape of a React
// effect: the cleanup aborts with a reason, and the catch ignores exactly
// that reason instead of every error.
{
  const unmount = new AbortController();
  const signal = AbortSignal.any([unmount.signal, AbortSignal.timeout(5_000)]);
  const lines: string[] = [];
  const done = (async () => {
    try {
      for await (const line of readLines(fakeResponse(many, { delayMs: 20 }), { signal })) {
        lines.push(line);
      }
    } catch (error) {
      if (signal.reason === "unmounted") return "stopped quietly";
      throw error;
    }
    return "finished";
  })();

  await sleep(90);
  unmount.abort("unmounted"); // useEffect(() => { …; return () => controller.abort("unmounted") })
  console.log(await done, `after ${lines.length} lines`);
  // → stopped quietly after 4 lines
}

// With a real fetch, pass the same signal to fetch(url, { signal }) as well:
// aborting then also errors the body stream with the reason and closes the
// connection, not just the reader.
