# 007 · Intl.Segmenter: Characters Users See

**Type:** TIL · **Stack:** TypeScript, Node 22 (`tsx`), React 19 types · **Date:** 2026-11-06

`"👨‍👩‍👧".length` is 8. JavaScript strings are UTF-16 code units, so `.length`, `slice` and `maxLength` all disagree with what a person sees on screen, and even spreading into code points still splits skin tones, flags and combining accents. `Intl.Segmenter` (in every evergreen browser and Node 16+) splits text into graphemes, words or sentences using the platform's ICU data. These examples show where the naive version breaks and the small, reusable fix for each case: truncation, word counts, caret movement, and a form field limit.

## Key points

- **`01-length-lies.ts`**: the same visible character can be 1, 2, 4 or 8 code units. `[...s]` fixes surrogate pairs only; `normalize()` merges `e` + `◌́` into `é` but can't touch emoji sequences. Only grapheme segmentation matches the eye.
- **`02-truncate.ts`**: `s.slice(0, n) + "…"` can leave a lone surrogate (`�`) or half a skin-tone modifier. Walking segments and slicing at the segment's `index` is always safe, and the loop stops early, so long strings are never fully segmented.
- **`03-word-count.ts`**: `split(/\s+/)` reports 1 word for a Japanese or Chinese sentence. The `word` granularity plus `isWordLike` counts words in languages without spaces and skips punctuation. The `sentence` granularity is rule-based ("Dr." still ends a sentence), so treat it as an estimate.
- **`04-caret-and-backspace.ts`**: `segments.containing(i)` turns a code-unit caret position into grapheme boundaries, which is what Backspace, ArrowLeft/Right and string reversal need in a custom editor.
- **`05-character-counter.tsx`**: a `useGraphemeLimit` hook and `BioField` that replace native `maxLength` (which counts code units), clip pastes on a grapheme boundary, and only announce the remaining count through a polite live region near the limit.

## What I practiced

- **Three units of "length".** Code units (`.length`, `slice`, `selectionStart`), code points (`[...s]`, `codePointAt`) and graphemes (`Intl.Segmenter`). Indexes stay in code units; segmentation tells you *which* code-unit offsets are safe to cut at.
- **Segments are lazy and carry their offset.** Iterating `segment()` yields `{ segment, index }` on demand, so truncating or limiting only does work up to the limit, and `index` plugs straight back into `slice`.
- **Locale matters for words, not for graphemes.** Grapheme rules are universal (one shared segmenter is fine), while word breaking uses per-language dictionaries, so pass the content's locale, not the UI's.

## Run

```bash
npm install
npm run examples   # runs 01–04 with tsx
npm run typecheck  # strict tsc over all five files, including the React hook
```
