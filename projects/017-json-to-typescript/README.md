# 017 · JSON to TypeScript

**Type:** mini-app · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-17

Paste a JSON payload and get TypeScript declarations for it. The interesting part is arrays: every item is folded into one shape, so a key that only some items have comes out optional, a field that is sometimes a string and sometimes `null` comes out `string | null`, and two objects with the same structure (a shipping and a billing address) share one interface instead of producing two.

## Features

- Live conversion as you type, with inference running on a `useDeferredValue` copy so large pastes don't block the textarea
- Array items merged field by field: missing keys become `?`, mixed values become unions, mixed arrays print as `(Item | number | null)[]`, empty arrays as `unknown[]`
- Structural dedupe: objects with the same keys and types (in any order) get one name
- Names from keys: `line_items` → `LineItem`, `addresses` → `Address`, `data` → `DataItem`; names that would shadow globals (`Date`, `Map`) get a suffix, collisions get a number
- Keys that aren't identifiers are quoted (`"created-at": string`)
- Options for the root name, `interface` vs `type`, `readonly` (fields and arrays) and `export`
- JSON errors show a clickable "Line 2, column 8" that puts the caret on the bad character; the last valid output stays on screen (dimmed) while you fix it
- Sample, Format and Clear buttons, copy with a polite live-region status
- Native radios and checkboxes under the custom styling, visible focus rings, light/dark theme, transitions off under `prefers-reduced-motion`

## What I practiced

- **Inference as a merge.** I modelled types as a small `Shape` union (primitive, object, array, union, plus `never` for "no items seen yet") and wrote one `merge(a, b)`. Arrays reduce their items through it starting from `never`, objects mark one-sided keys optional, and unions keep at most one object and one array member, merging into them. That last rule is what turns `[{a: 1}, {b: 2}]` into one interface with two optional fields instead of `A | B`.
- **Naming and dedupe from a structural signature.** Each object gets a canonical string (sorted keys, optional flags, nested signatures), and a `Map<signature, name>` hands out names. I reserve the output slot before recursing so the root prints first and children follow in the order they appear.
- **Locating JSON errors myself.** Chromium's `JSON.parse` errors often say `Unexpected token '}'` with no position, and Firefox words them differently, so on failure a ~80-line recursive-descent scanner walks the text and returns the offset of the first bad character. The engine message is kept, minus the copy of the whole input that V8 echoes back.

## Limits

- A key that is only ever `null` types as `null`; widen it by hand once you know what it holds
- Strings aren't sniffed for dates, enums or numeric ids; everything stays `string`

## Run

```bash
npm install
npm run dev
```
