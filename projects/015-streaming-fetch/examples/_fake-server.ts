// A stand-in for the network: a real Response whose body arrives in exactly the
// byte chunks you give it, optionally with a delay between them. Everything in
// these examples only touches the standard Response / ReadableStream API, so
// swapping fakeResponse(...) for fetch(...) changes nothing downstream.

const encoder = new TextEncoder();

export type FakeOptions = {
  /** Wait this long before each chunk, like a slow connection. */
  delayMs?: number;
  /** Called when the consumer cancels the body (the "server" can stop work). */
  onCancel?: (reason: unknown) => void;
  /** Called every time the stream asks the source for another chunk. */
  onPull?: (index: number) => void;
  init?: ResponseInit;
};

export function fakeResponse(
  chunks: ReadonlyArray<string | Uint8Array>,
  { delayMs = 0, onCancel, onPull, init }: FakeOptions = {},
): Response {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    // pull() is only called when the internal queue has room, so a consumer
    // that stops reading also stops the source. That's backpressure.
    async pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      onPull?.(index);
      if (delayMs > 0) await sleep(delayMs);
      const chunk = chunks[index++]!;
      controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
    },
    cancel(reason) {
      onCancel?.(reason);
    },
  });
  return new Response(body, init);
}

/** Encode text and cut the bytes every `size` bytes, ignoring character boundaries. */
export function cutBytes(text: string, size: number): Uint8Array[] {
  const bytes = encoder.encode(text);
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, i + size));
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
