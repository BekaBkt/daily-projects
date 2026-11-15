# 015 · Reading Streamed Responses

**Type:** TIL · **Stack:** TypeScript, Web Streams, Node 22 (`tsx`) · **Date:** 2026-11-15

`await res.json()` waits for the whole body. Streaming chat answers, search results that arrive shard by shard, long exports and big downloads all want the opposite: use `res.body`, a `ReadableStream<Uint8Array>`, and handle data as it lands. The catch is that chunk boundaries come from the network, not from your format, so a chunk can end halfway through a JSON line or a UTF-8 character. These examples build the layers bottom-up (decoding, line framing, NDJSON, Server-Sent Events over `fetch`, progress, cancellation) using only standard APIs, so the same code runs in the browser. A fake `Response` that cuts bytes at awkward places stands in for the network.

## Key points

- **`01-chunks-lie.ts`**: decoding each chunk separately turns a cut "т" into `��`, and `JSON.parse` per chunk fails 11 times out of 11. One `TextDecoder` with `{ stream: true }`, or `TextDecoderStream`, fixes text; messages need a framing layer.
- **`_streams.ts` + `02-lines.ts`**: `iterate()` is a reader loop in an async generator whose `finally` always cancels and releases the reader. `lineSplitter()` is a `TransformStream` that buffers partial lines and holds back a trailing `\r` in case the `\n` arrives in the next chunk.
- **`03-ndjson.ts`**: `readNdjson(response, validate)` yields typed values one line at a time, so the first hit renders after ~200 ms instead of ~1 s, and a broken line throws with its line number.
- **`04-sse-over-fetch.ts`**: a spec-following SSE parser (multi-line `data:`, `event:`, persistent `id:`, `retry:`, comments, dispatch on blank line, incomplete trailing event dropped) for POST endpoints that `EventSource` can't call, plus `Last-Event-ID` for resuming.
- **`05-progress.ts`**: download progress with a byte-counting `TransformStream`, re-wrapped in `new Response()` so `.json()` still works. With `Content-Encoding` the total is unknown, so the bar becomes indeterminate instead of passing 100%.
- **`06-cancel.ts`**: `break`, `AbortSignal.timeout()` and an unmount-style `AbortSignal.any()` all propagate back through the `pipeThrough` chain and cancel the source, and backpressure means the source only produced a handful of the 100 chunks.

## What I practiced

- **Framing is my job, not the network's.** Bytes → text needs a streaming decoder, text → messages needs a buffer that only emits on a delimiter, and both have to survive any split. Testing with deliberately bad chunk sizes caught the `\r\n` bug that "works on localhost" would have hidden.
- **Cleanup belongs in the generator's `finally`.** A `for await` that breaks calls `return()`, so cancelling the reader there means every way out (end, error, break, abort) tells the server to stop, instead of leaving the connection running after the component is gone.
- **Streams compose like functions.** `body.pipeThrough(decoder).pipeThrough(lines)` keeps backpressure and cancellation working end to end, and wrapping a transformed stream in `new Response()` gives the convenience methods back.

## Run

```bash
npm install
npm run examples   # runs 01–06 with tsx; each file prints what it demonstrates
npm run typecheck  # strict tsc, DOM lib only, no Node-specific APIs
```

Every example uses only `Response`, `ReadableStream`, `TransformStream`, `TextDecoderStream` and `AbortSignal`, so the helpers in `_streams.ts`, `03` and `04` can be pasted into a browser app and pointed at a real `fetch()`.
