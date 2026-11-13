# 013 · Easing Curve Editor

**Type:** mini-app · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-13

A visual editor for CSS `cubic-bezier()` timing functions. Drag the two control points (or move them with the keyboard), watch a ball run the curve next to a linear one, and copy the result straight into a `transition`. Paste an existing value to inspect it, flip an ease-in into its matching ease-out, or share a curve through the URL.

## Features

- SVG curve editor with two draggable control points, a dashed linear reference and room above and below the unit square for overshooting curves (y from −0.6 to 1.6)
- Control points are focusable `role="slider"` handles: arrow keys move them by 0.01, <kbd>Shift</kbd>+arrows by 0.1, and `aria-valuetext` announces both coordinates
- Text field that accepts `cubic-bezier(.25,.1,.25,1)`, a bare `0.25 0.1 0.25 1` list or a keyword, with errors that name the bad number ("x1: 1.2 is outside 0–1")
- Presets for the CSS keywords plus common cubic, expo, quart and back curves, shown as toggle chips (`aria-pressed`)
- Side-by-side preview against linear with an adjustable duration, plus a static strip of 11 equally timed frames that shows the spacing without any motion
- "Reverse it" turns a curve into its time-mirrored twin (ease-in ↔ ease-out)
- Copy button with a live status message, the current curve kept in the URL hash (`#0.34,1.56,0.64,1`)
- Visible focus rings, light/dark theme, and `prefers-reduced-motion` turns the preview animation off

## What I practiced

- **Evaluating a bezier as y = f(x).** The curve is parametric, so the eased value at progress `x` needs the `t` where `x(t) = x` first. I wrote the polynomial form `((a·t + b)·t + c)·t`, ran Newton–Raphson from `t = x` (2–4 steps for normal curves) and fell back to bisection when the slope goes flat. That fallback always works because clamping x1 and x2 to [0, 1] keeps `x(t)` monotonic.
- **Pointer math in a scaled SVG.** Dragging uses `setPointerCapture` so the drag survives leaving the handle, and `getScreenCTM().inverse()` maps client pixels to SVG units, so the editor works at any CSS size without measuring anything.
- **A 2D control on a 1D ARIA role.** There is no 2D slider role, so each handle is a `slider` whose value is y, with both coordinates in `aria-valuetext` and the key bindings in a shared description. The SVG focus ring is drawn on the hit circle because outlines on `<g>` are unreliable.

## Run

```bash
npm install
npm run dev
```
