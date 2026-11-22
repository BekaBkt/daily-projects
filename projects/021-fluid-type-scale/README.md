# 021 · Fluid Type Scale

**Type:** mini-app · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-22

A generator for fluid type scales: set a base size and a scale ratio for a small and a large viewport, and every step of the scale gets a `clamp()` that grows linearly between the two widths. On top of the usual output it checks each step against WCAG 1.4.4 (Resize text), because a `clamp()` with a big `vw` part can stop text from reaching 200% when the user zooms the page.

## Features

- Separate base size and ratio for the min and max viewport, so headings can grow faster than body text (e.g. minor third on phones, major third on desktop)
- One `clamp()` per step as CSS custom properties (`--step-0`, `--step--1`, ...) in `rem` or `px`, with a configurable root size and a Copy button that reports through a live region
- Chart of size against viewport width for every step: flat below the min width, linear in between, flat above it, with a marker for the preview width
- Preview slider (native range input, so arrows/Page Up/Home/End work) that renders each step with your own sample text at the size the browser would compute at that width
- Zoom gain per step, the worst window width it happens at, and a warning when a step fails
- Inline validation: invalid fields are marked with `aria-invalid` and a described error, and the results dim but keep showing the last valid scale
- Settings live in the URL hash, so a scale can be shared as a link
- Ratio presets through a `<datalist>` (minor second to golden ratio) while still accepting any number
- Light/dark theme, visible focus rings, dim transition off under `prefers-reduced-motion`

## What I practiced

- **Turning two points into a `clamp()`.** Each step is a line through `(minViewport, minSize)` and `(maxViewport, maxSize)`. The slope times 100 is the `vw` coefficient and the intercept is the `rem` part. When the max size is smaller than the min (a small step with a bigger desktop ratio) the slope goes negative and the bounds have to swap, because `clamp()` needs min ≤ max. I also write the positive term first, so the output reads `7vw - 1.875rem` and not `-1.875rem + 7vw`.
- **Modelling page zoom.** At zoom `z` the layout viewport shrinks to `width / z` CSS px and each CSS px is drawn `z` times larger. So the rendered gain is `z · size(width / z) / size(width)`: the rem part scales, the vw part is measured against a narrower viewport and doesn't. For every window width I take the best gain up to 500% zoom and report the worst of those. The result matches the rule of thumb that a step passes as long as its max size is at most 2.5× its min, but now the app gives a number and a width for each step instead of a rule.
- **Keeping form state as strings.** The inputs hold raw strings and one `parseDraft` turns them into either a typed `ScaleConfig` or a map of errors. That way typing `1.` doesn't get reformatted under the caret, and the results can keep the last valid config in a ref while a field is broken.

## Run

```bash
npm install
npm run dev
```
