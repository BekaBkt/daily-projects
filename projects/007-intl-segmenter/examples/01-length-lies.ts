// 01 · `.length` counts UTF-16 code units, not the characters a person sees.
import { graphemes } from "./_graphemes";

const samples = [
  "hello",
  "café", // precomposed é: one code unit
  "cafe\u0301", // e + combining acute accent: looks identical, two code units
  "👍", // astral code point: a surrogate pair
  "👍🏽", // emoji + skin-tone modifier
  "👨‍👩‍👧", // three people joined by zero-width joiners (ZWJ)
  "🇹🇷", // flag = two regional-indicator letters
];

console.log("string        .length  [...s]  graphemes");
for (const s of samples) {
  console.log(
    s.padEnd(12),
    String(s.length).padStart(7),
    String([...s].length).padStart(7),
    String(graphemes(s).length).padStart(10),
  );
}
// → hello               5       5          5
// → café                4       4          4
// → café                5       5          4
// → 👍                  2       1          1
// → 👍🏽                  4       2          1
// → 👨‍👩‍👧                  8       5          1
// → 🇹🇷                  4       2          1
//
// Spreading (`[...s]`, `Array.from`) iterates code points, which fixes surrogate
// pairs but still splits modifiers, ZWJ sequences, flags and combining marks.
// Only grapheme segmentation matches what the user sees as "one character".

// "café" written two ways isn't even equal, until you normalize:
const composed: string = "caf\u00e9"; // é as one code point (U+00E9)
const decomposed: string = "cafe\u0301"; // e + U+0301 combining acute
console.log(composed === decomposed, composed.normalize() === decomposed.normalize());
// → false true
// Normalizing (NFC) merges e + ◌́ into é, but it can't merge emoji sequences:
console.log("👨‍👩‍👧".normalize().length); // → 8
