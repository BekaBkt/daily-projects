# 005 · Contrast Fixer

**Type:** mini-app · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-04

A WCAG 2.2 contrast checker that does more than say "fail". Pick a text and background colour, see the ratio against every AA/AAA threshold, and get the closest colour that passes, found by moving only lightness in OKLCH so the hue of your brand colour survives.

## Features

- Live contrast ratio with pass/fail for AA, AAA, large text and UI components
- "Fix it" suggestions for the text colour *or* the background, for any target level, with one-click apply
- Live preview with body text, large text and an outlined UI element
- Native colour pickers plus hex fields (`#rgb` or `#rrggbb`) that only commit valid values
- Shareable state: the pair lives in the URL hash (`#fg=8a8f98&bg=ffffff`)
- Keyboard friendly, visible focus rings, light/dark page theme, respects `prefers-reduced-motion`

## What I practiced

- **WCAG contrast math.** sRGB → linear → relative luminance → `(L1 + 0.05) / (L2 + 0.05)`. The ratio is truncated for display, never rounded up, because 4.499:1 does not pass AA.
- **OKLCH for perceptual edits.** Converting to OKLCH and changing only `L` keeps hue and chroma, so `#ff6600` becomes a darker orange (`#d74000`) instead of a muddy brown. The search walks lightness both ways, checks the *real* clipped hex value at each step, and keeps the smaller change.
- **Controlled inputs with drafts.** The hex field keeps its own draft and commits 6-digit values while typing and 3-digit ones on blur, so typing `#abcdef` is never hijacked by `#abc` expanding to `#aabbcc`.

## Run

```bash
npm install
npm run dev
```
