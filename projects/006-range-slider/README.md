# 006 · Dual Range Slider

**Type:** component · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-05

A reusable two-thumb range slider built on the WAI-ARIA slider pattern, without a native `<input type="range">`. Each thumb is its own `role="slider"`, the pair can never cross or get closer than a minimum gap, and anything can be drawn behind the track. The demo filters 160 generated stays by nightly price over a live histogram, and picks a "quiet hours" window formatted as `HH:MM`.

## Features

- Controlled API: `value: [low, high]`, `onChange`, `min`, `max`, `step`, `largeStep`, `minGap`, `formatValue`, `thumbLabels`, `disabled`, `background`
- Keyboard per thumb: arrows move one step, `Page Up`/`Page Down` move a large step, `Home`/`End` jump to that thumb's current limit
- Pointer: drag a thumb, or press the bare track to jump the nearest thumb there and keep dragging
- Thumbs stacked on the same value are resolved by drag direction; the low thumb rises on top at the right end so it can still be grabbed
- Each thumb reports dynamic `aria-valuemin`/`aria-valuemax` (the other thumb ± gap) and a formatted `aria-valuetext`
- Value bubbles on hover, focus and drag; visible focus ring; light and dark themes; respects `prefers-reduced-motion`

## What I practiced

- **Pointer capture for dragging.** `setPointerCapture` on the track sends every `pointermove` to it until release, even when the cursor leaves the element or the window, so there are no `document` listeners to add and clean up. `touch-action: none` stops the page from scrolling during a touch drag.
- **Constraints as one function.** A single `bounds(thumb, value)` gives each thumb's allowed range; keyboard, pointer and the ARIA min/max all read from it, so the "no crossing, keep the gap" rule lives in one place.
- **Snapping without float drift.** Values snap as `round((raw - min) / step) * step + min` and are then trimmed to the step's decimal count, so `step={0.1}` yields `0.3`, not `0.30000000000000004`.

## Run

```bash
npm install
npm run dev
```
