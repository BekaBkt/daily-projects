// 04 · Server-Sent Events over fetch, parsed by hand.
//
// EventSource only does GET, can't send an Authorization header, and can't
// be aborted with a signal. Chat-style APIs that stream tokens therefore
// answer a POST with `text/event-stream`, and the client reads it with fetch.
// The format is small enough to parse correctly in ~40 lines, following the
// "interpret an event stream" rules from the HTML spec.
import { cutBytes, fakeResponse } from "./_fake-server";
import { readLines } from "./_streams";

export type SseMessage = {
  /** `event:` field, "message" when absent. */
  event: string;
  /** All `data:` lines of the event, joined with "\n". */
  data: string;
  /** Last seen `id:`. It persists across events, as in EventSource. */
  lastEventId: string;
  /** Last valid `retry:` in ms, for your own reconnect logic. */
  retry: number | undefined;
};

export async function* readSse(
  response: Response,
  options?: { signal?: AbortSignal },
): AsyncGenerator<SseMessage, void, undefined> {
  let event = "";
  let data = "";
  let lastEventId = "";
  let retry: number | undefined;

  for await (const line of readLines(response, options)) {
    // A blank line dispatches. No data means nothing to dispatch, but the
    // event type is reset either way.
    if (line === "") {
      if (data !== "") {
        yield { event: event || "message", data: data.slice(0, -1), lastEventId, retry };
      }
      event = "";
      data = "";
      continue;
    }
    if (line.startsWith(":")) continue; // comment, often a ": ping" heartbeat

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1); // exactly one space

    switch (field) {
      case "event":
        event = value;
        break;
      case "data":
        data += value + "\n";
        break;
      case "id":
        if (!value.includes("\0")) lastEventId = value;
        break;
      case "retry":
        if (/^\d+$/.test(value)) retry = Number(value);
        break;
      // Unknown fields are ignored on purpose.
    }
  }
  // An event without its terminating blank line is incomplete and dropped.
}

// What a streaming completion endpoint might send: a heartbeat comment, a
// retry hint, token events with ids, a multi-line data event, a final "done",
// and a trailing event the connection dropped before finishing.
const stream = [
  ": connected",
  "retry: 3000",
  "",
  "event: token",
  "id: 1",
  'data: {"text":"Streams "}',
  "",
  "event: token",
  "id: 2",
  'data: {"text":"are "}',
  "",
  ": ping",
  "event: token",
  "id: 3",
  'data: {"text":"just iterables."}',
  "",
  "event: note",
  "data: line one",
  "data:line two (no space after the colon is valid too)",
  "",
  "event: done",
  "data: [DONE]",
  "",
  "event: token",
  'data: {"text":" never seen"}',
].join("\r\n");

let answer = "";
let lastId = "";
for await (const message of readSse(fakeResponse(cutBytes(stream, 7)))) {
  lastId = message.lastEventId;
  if (message.event === "token") {
    answer += (JSON.parse(message.data) as { text: string }).text;
  } else if (message.event === "done") {
    console.log("done, retry hint:", message.retry, "ms");
  } else {
    console.log(`${message.event}:`, JSON.stringify(message.data));
  }
}
console.log("answer:", answer);
// → note: "line one\nline two (no space after the colon is valid too)"
// → done, retry hint: 3000 ms
// → answer: Streams are just iterables.

// To resume after a dropped connection, send the last id back the way
// EventSource would. The server decides what to replay.
const resumeHeaders = new Headers({ Accept: "text/event-stream", "Last-Event-ID": lastId });
console.log("resume with Last-Event-ID:", resumeHeaders.get("Last-Event-ID")); // → 3
