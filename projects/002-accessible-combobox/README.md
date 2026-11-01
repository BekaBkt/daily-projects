# 002 · Accessible Combobox

**Type:** component · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-01

A reusable, generic autocomplete input built on the WAI-ARIA 1.2 combobox pattern. It works with any item type through `getLabel`/`getKey`, highlights the matching text, and is fully usable from the keyboard or a screen reader. The demo searches all 400+ IANA time zones from `Intl.supportedValuesOf` and shows a live clock for the chosen one.

## Features

- Generic API: `Combobox<T>` with `items`, `value`, `onChange`, `getLabel`, optional `getKey` and `renderOption`
- Keyboard: `↓`/`↑` open and move with wrap-around, `Alt+↓` opens without moving, `Enter` selects, `Esc` closes then clears
- Focus never leaves the input; the highlighted option is announced through `aria-activedescendant`
- Result count announced in a polite live region
- Matched substring wrapped in `<mark>`; highlighted option scrolled into view
- Unconfirmed text reverts to the last real selection on blur
- `maxResults` cap keeps huge lists fast; light and dark themes; respects `prefers-reduced-motion`

## What I practiced

- **`aria-activedescendant` vs. roving focus.** In a combobox the caret has to stay in the input so typing keeps working, so DOM focus never moves to options. Instead the input points at the active option's id, and `scrollIntoView({ block: "nearest" })` keeps it visible.
- **Deriving state instead of syncing it.** The active index is clamped during render (`activeIndex < results.length`), and the input text follows an external `value` change by comparing labels during render, not in an effect. No stale highlights, no extra renders.
- **`preventDefault` on `mousedown`.** Clicking an option would blur the input and close the list before `click` fires. Cancelling `mousedown` on options and the toggle button keeps focus where it is.

## Run

```bash
npm install
npm run dev
```
