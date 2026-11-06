// 02 · Truncating without cutting a character in half.
import { graphemeSegmenter } from "./_graphemes";

const name = "Ayşe 👩🏽‍💻 & team 🇹🇷";

// The usual one-liner slices code units. At an unlucky index it leaves a lone
// surrogate (rendered as �) or strips a skin tone / flag half.
const naive = (s: string, max: number) => (s.length > max ? s.slice(0, max) + "…" : s);
console.log(JSON.stringify(naive(name, 6)));
// → "Ayşe \ud83d…"  (half of 👩, a broken character on screen)
console.log(JSON.stringify(naive(name, 8)));
// → "Ayşe 👩\ud83c…"  (woman, then half a skin-tone modifier)

// Grapheme-aware: walk segments, stop before the one that would overflow.
// `index` is the code-unit offset of each segment, so slicing there is always safe.
export function truncate(text: string, maxGraphemes: number, ellipsis = "…"): string {
  let count = 0;
  for (const { index } of graphemeSegmenter.segment(text)) {
    if (count === maxGraphemes) return text.slice(0, index).trimEnd() + ellipsis;
    count++;
  }
  return text; // fits: no ellipsis
}

console.log(truncate(name, 6)); // → Ayşe 👩🏽‍💻…
console.log(truncate(name, 5)); // → Ayşe…   (trailing space trimmed)
console.log(truncate(name, 99)); // → unchanged

// Note: the loop stops early, so truncating a 1 MB string to 20 characters
// only segments the first 21 graphemes. No full array is ever built.
