// 02 · A line splitter is the first framing layer.
//
// Most streaming formats (NDJSON, SSE, logs, CSV) are line based, so turning
// "text chunks" into "complete lines" is the step everything else sits on.
// It's a TransformStream, so it composes with pipeThrough and inherits
// backpressure: if the consumer stops reading, the splitter stops asking.
import { fakeResponse } from "./_fake-server";
import { iterate, lineSplitter, readLines } from "./_streams";

// Hostile chunking: "\r\n" split across chunks, an empty line, no newline at
// the end, and a lone "\r" (old Mac style), which the SSE spec allows.
const chunks = ["first\r", "\nsecond\nthi", "rd\r\r\n", "fourth\rlast"];

const lines: string[] = [];
for await (const line of readLines(fakeResponse(chunks))) lines.push(line);
console.log(lines);
// → [ 'first', 'second', 'third', '', 'fourth', 'last' ]

// ✗ The obvious version: split each chunk on its own. "thi" + "rd" become two
// lines, and "first\r" + "\n…" produces a phantom empty line.
const naive = chunks.flatMap((chunk) => chunk.split(/\r\n|\r|\n/));
console.log(naive);
// → [ 'first', '', '', 'second', 'thi', 'rd', '', '', 'fourth', 'last' ]

// The splitter is a plain TransformStream, so it also works on its own,
// outside fetch: write strings in, read lines out.
const { readable, writable } = lineSplitter();
const writer = writable.getWriter();
void (async () => {
  for (const piece of ["a,b", ",c\n1,", "2,3\n"]) await writer.write(piece);
  await writer.close();
})();
const rows: string[][] = [];
for await (const line of iterate(readable)) rows.push(line.split(","));
console.log(rows); // → [ [ 'a', 'b', 'c' ], [ '1', '2', '3' ] ]
