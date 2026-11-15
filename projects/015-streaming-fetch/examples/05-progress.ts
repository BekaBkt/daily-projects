// 05 · Download progress without giving up response.json().
//
// fetch has no onprogress. The trick is a pass-through TransformStream that
// counts bytes on their way by, then wrapping the counted stream in a new
// Response so the usual .json() / .blob() / .text() still work.
import { cutBytes, fakeResponse } from "./_fake-server";

type Progress = { loaded: number; total: number | null };

function countBytes(total: number | null, onProgress: (p: Progress) => void) {
  let loaded = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      loaded += chunk.byteLength;
      onProgress({ loaded, total });
      controller.enqueue(chunk);
    },
  });
}

/**
 * Content-Length is the size on the wire. With Content-Encoding (gzip, br)
 * the body you read is decompressed and larger, so the total is meaningless:
 * show an indeterminate bar instead of one that runs past 100%.
 */
function knownTotal(response: Response): number | null {
  if (response.headers.get("Content-Encoding")) return null;
  const length = Number(response.headers.get("Content-Length"));
  return Number.isFinite(length) && length > 0 ? length : null;
}

export function withProgress(response: Response, onProgress: (p: Progress) => void): Response {
  if (!response.body) return response;
  const body = response.body.pipeThrough(countBytes(knownTotal(response), onProgress));
  // Keep status and headers so callers can't tell the difference.
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function bar({ loaded, total }: Progress): string {
  if (total === null) return `[${"·".repeat(20)}] ${loaded} bytes`;
  const ratio = Math.min(loaded / total, 1);
  const filled = Math.round(ratio * 20);
  return `[${"#".repeat(filled)}${" ".repeat(20 - filled)}] ${Math.round(ratio * 100)}%`;
}

const report = JSON.stringify({
  generatedAt: "2026-11-15",
  rows: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, value: Math.round(Math.sin(i) * 100) })),
});
const size = new TextEncoder().encode(report).byteLength;

const response = fakeResponse(cutBytes(report, 256), {
  delayMs: 15,
  init: { headers: { "Content-Type": "application/json", "Content-Length": String(size) } },
});

// In a UI this would set <progress value={loaded} max={total}>, or omit
// `value` for the indeterminate state, and aria-busy on the region loading.
const data = (await withProgress(response, (p) => console.log(bar(p))).json()) as {
  rows: unknown[];
};
console.log("parsed rows:", data.rows.length);
// → [######              ] 29%
// → [############        ] 58%   … up to 100%
// → parsed rows: 40

// Compressed response: same code, honest indeterminate output.
const gzipped = fakeResponse(cutBytes(report, 512), {
  init: { headers: { "Content-Encoding": "gzip", "Content-Length": "300" } },
});
await withProgress(gzipped, (p) => console.log(bar(p))).arrayBuffer();
// → [····················] 512 bytes
// → [····················] 887 bytes   (not "296%")
