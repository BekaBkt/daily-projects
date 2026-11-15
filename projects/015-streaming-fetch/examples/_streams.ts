// The two building blocks every other example uses.

/**
 * Async-iterate any ReadableStream, with cleanup that always runs.
 *
 * Streams are async iterable in Node and newer browsers, but not everywhere
 * yet, and the built-in iterator gives no hook for an AbortSignal. A reader
 * loop in a generator works in every runtime and makes the cleanup explicit:
 * `finally` runs when the stream ends, when it errors, and when the consumer
 * leaves a `for await` early (break/return/throw call the generator's return()).
 */
export async function* iterate<T>(
  stream: ReadableStream<T>,
  { signal }: { signal?: AbortSignal } = {},
): AsyncGenerator<T, void, undefined> {
  signal?.throwIfAborted();
  const reader = stream.getReader();
  // Cancelling resolves the pending read() with { done: true }, so the loop
  // exits and we turn that into the abort reason below.
  const onAbort = () => void reader.cancel(signal?.reason).catch(() => {});
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        signal?.throwIfAborted();
        return;
      }
      yield value;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    // On early exit this tells the source to stop (and propagates back through
    // any pipeThrough chain). After a normal end it's a harmless no-op.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/**
 * Split decoded text into lines, whatever the chunk boundaries are.
 *
 * Handles \n, \r\n and lone \r. A chunk ending in "\r" is held back, because
 * the "\n" that completes it may be the first byte of the next chunk; treating
 * it as a line end right away would invent an empty line.
 */
export function lineSplitter(): TransformStream<string, string> {
  let buffer = "";
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      buffer += chunk;
      const end = buffer.endsWith("\r") ? buffer.length - 1 : buffer.length;
      const lines = buffer.slice(0, end).split(/\r\n|\r|\n/);
      buffer = lines.pop()! + buffer.slice(end);
      for (const line of lines) controller.enqueue(line);
    },
    flush(controller) {
      if (buffer.endsWith("\r")) controller.enqueue(buffer.slice(0, -1));
      else if (buffer) controller.enqueue(buffer);
    },
  });
}

/** Response body → async iterable of text lines. */
export function readLines(response: Response, options?: { signal?: AbortSignal }) {
  if (!response.body) throw new TypeError("Response has no body");
  const lines = response.body
    // TextDecoderStream keeps a multi-byte character that was cut in half
    // until its remaining bytes arrive, and strips a leading BOM.
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(lineSplitter());
  return iterate(lines, options);
}
