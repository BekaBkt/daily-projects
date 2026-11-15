// 01 · Chunks don't line up with anything you care about.
//
// A streamed body arrives as Uint8Array chunks whose boundaries come from TCP,
// proxies and compression, not from your protocol. A chunk can end in the
// middle of a JSON line, and in the middle of a multi-byte UTF-8 character.
import { cutBytes, fakeResponse } from "./_fake-server";
import { iterate } from "./_streams";

const payload =
  '{"city":"Алматы","temp":-3}\n' +
  '{"city":"Kraków ❄️","temp":1}\n' +
  '{"city":"東京","temp":14}\n';

// Same bytes every run: cut every 9 bytes, regardless of characters.
const chunks = cutBytes(payload, 9);

// ✗ Decoding each chunk on its own. A Cyrillic letter is 2 bytes, a kanji 3,
// the snowflake 3 + a 3-byte variation selector. Any of them cut in half
// decodes to U+FFFD "�".
const naive = chunks.map((chunk) => new TextDecoder().decode(chunk)).join("");
console.log("per-chunk decode broke", count(naive, "\uFFFD"), "characters");
console.log("  ", naive.split("\n")[0]);
// → per-chunk decode broke 2 characters
// →    {"city":"Алма��ы","temp":-3}   ("т" was cut between chunks 2 and 3)

// ✓ One decoder with { stream: true } keeps the dangling bytes until the rest
// arrive. A final decode() with no argument flushes (and reports a truncated
// character at the very end, if any).
const decoder = new TextDecoder();
let text = "";
for (const chunk of chunks) text += decoder.decode(chunk, { stream: true });
text += decoder.decode();
console.log("streaming decode intact:", text === payload); // → true

// ✗ Parsing each chunk as JSON fails even with correct decoding: a chunk is
// not a message.
let parsed = 0;
let failed = 0;
const lineDecoder = new TextDecoder();
for (const chunk of chunks) {
  try {
    JSON.parse(lineDecoder.decode(chunk, { stream: true }));
    parsed++;
  } catch {
    failed++;
  }
}
console.log(`JSON.parse per chunk: ${parsed} ok, ${failed} failed`);
// → JSON.parse per chunk: 0 ok, 11 failed

// The fix for text is TextDecoderStream (the stream version of the decoder
// above), and the fix for messages is a framing layer that buffers until a
// delimiter: lines in 02, NDJSON in 03, SSE events in 04.
const res = fakeResponse(chunks);
let decoded = "";
for await (const piece of iterate(res.body!.pipeThrough(new TextDecoderStream()))) decoded += piece;
console.log("TextDecoderStream intact:", decoded === payload); // → true

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
