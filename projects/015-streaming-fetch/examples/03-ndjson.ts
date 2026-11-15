// 03 · NDJSON: render results while the response is still arriving.
//
// Newline-delimited JSON is one JSON value per line. A search endpoint that
// streams hits this way lets the UI show the first result after the first
// line instead of after the slowest shard answers.
import { cutBytes, fakeResponse } from "./_fake-server";
import { readLines } from "./_streams";

type Hit = { id: number; title: string; score: number };

/**
 * Yield one validated value per line. A bad line throws with its line number
 * instead of a bare "Unexpected token" from somewhere in the middle of a stream.
 */
export async function* readNdjson<T>(
  response: Response,
  validate: (value: unknown) => T,
  options?: { signal?: AbortSignal },
): AsyncGenerator<T, void, undefined> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let lineNo = 0;
  for await (const line of readLines(response, options)) {
    lineNo++;
    if (line.trim() === "") continue; // tolerate blank keep-alive lines
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new SyntaxError(`NDJSON line ${lineNo} is not valid JSON: ${line.slice(0, 40)}`);
    }
    yield validate(value);
  }
}

function toHit(value: unknown): Hit {
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "number" &&
    "title" in value &&
    typeof value.title === "string" &&
    "score" in value &&
    typeof value.score === "number"
  ) {
    return { id: value.id, title: value.title, score: value.score };
  }
  throw new TypeError(`Not a search hit: ${JSON.stringify(value)}`);
}

const hits: Hit[] = [
  { id: 1, title: "Streams API — MDN", score: 0.97 },
  { id: 2, title: "Backpressure explained", score: 0.91 },
  { id: 3, title: "Ağ akışları (Turkish notes)", score: 0.74 },
  { id: 4, title: "Потоковая передача данных", score: 0.68 },
];
const body = hits.map((hit) => JSON.stringify(hit)).join("\n") + "\n";

// 11-byte chunks, 40 ms apart: lines, Cyrillic and Turkish letters all get cut.
const started = Date.now();
const results: Hit[] = [];
for await (const hit of readNdjson(fakeResponse(cutBytes(body, 11), { delayMs: 40 }), toHit)) {
  results.push(hit);
  // In React this is setResults((r) => [...r, hit]); the first row paints early.
  console.log(`+${String(Date.now() - started).padStart(4)}ms  #${hit.id} ${hit.title}`);
}
// → +  ~200ms  #1 Streams API — MDN
// → +  ~400ms  #2 Backpressure explained   … one line per hit, as it completes

// A broken line fails loudly, with context, and stops the stream.
const broken = '{"id":1,"title":"ok","score":1}\n{"id":2,"title":"cut off\n';
try {
  for await (const hit of readNdjson(fakeResponse([broken]), toHit)) console.log("got", hit.id);
} catch (error) {
  console.log((error as Error).message);
}
// → got 1
// → NDJSON line 2 is not valid JSON: {"id":2,"title":"cut off
