// 04 · Editing at a caret: Backspace, arrow keys and reversing a string.
//
// Inputs report `selectionStart` in UTF-16 code units. Custom editors (chips,
// masked inputs, mention pickers) that move or delete "one character" must
// move by graphemes, or the caret lands inside an emoji.
import { graphemeSegmenter, graphemes } from "./_graphemes";

/** Code-unit offset of the grapheme boundary before `caret`. */
export function previousBoundary(text: string, caret: number): number {
  if (caret <= 0) return 0;
  // `containing(i)` returns the segment that covers code unit i.
  return graphemeSegmenter.segment(text).containing(caret - 1)?.index ?? 0;
}

/** Code-unit offset of the grapheme boundary after `caret`. */
export function nextBoundary(text: string, caret: number): number {
  const seg = graphemeSegmenter.segment(text).containing(caret);
  return seg ? seg.index + seg.segment.length : text.length;
}

/** What Backspace should do: delete one whole grapheme before the caret. */
export function backspace(text: string, caret: number): { text: string; caret: number } {
  const start = previousBoundary(text, caret);
  return { text: text.slice(0, start) + text.slice(caret), caret: start };
}

const text = "hi 👨‍👩‍👧!"; // the family is 8 code units, caret sits before "!"
const caret = text.indexOf("!");

console.log(caret); // → 11
console.log(JSON.stringify(text.slice(0, caret - 1) + text.slice(caret)));
// → "hi 👨‍👩‍\ud83d!"   naive: one code unit removed, leaving half of 👧 (a lone surrogate)
console.log(backspace(text, caret));
// → { text: 'hi !', caret: 3 }   one keypress, one visible character

console.log(nextBoundary(text, 3), previousBoundary(text, 11)); // → 11 3 (ArrowRight / ArrowLeft)

// Reversing: `split("")` breaks surrogate pairs, `[...s]` still breaks ZWJ and flags.
const s = "abc🇹🇷👍🏽";
console.log(s.split("").reverse().join("")); // → garbage with lone surrogates
console.log([...s].reverse().join("")); // → 🏽👍🇷🇹cba  (modifier and flag letters swapped)
console.log(graphemes(s).reverse().join("")); // → 👍🏽🇹🇷cba
