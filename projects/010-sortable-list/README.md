# 010 · Accessible Sortable List

**Type:** component · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-09

A drag-to-reorder list that works the same with a mouse, a finger, or only a keyboard, with no drag-and-drop library and no HTML5 `draggable`. Each row gets a handle button: drag it, or focus it and press Space to pick the row up, move it with the arrow keys, and drop or cancel. Every step is announced through a live region, and rows slide into place with a FLIP animation. The demo ranks a sprint backlog with rows of different heights, and orders a set list whose start times recalculate while a track is still being dragged.

## Features

- Controlled, generic API: `items`, `getKey`, `getLabel`, `renderItem(item, { index, active, order })`, `onReorder(from, to)`, plus an exported `arrayMove` helper
- Keyboard: `Space`/`Enter` to pick up and drop, `↑`/`↓` to move, `Home`/`End` to jump, `Escape` to cancel; tabbing away cancels too
- Pointer and touch: drag the handle past a 4px threshold, neighbours glide aside, the row is clamped to the list, works with variable row heights
- `onReorder` fires once on drop, not on every step; `renderItem` still sees the previewed `order` so dependent values (ranks, start times) update live
- Screen reader support: handle labelled "Reorder …", instructions via `aria-describedby`, `aria-pressed` while lifted, assertive live region for pick up / move / drop / cancel
- Visible focus ring that stays on the moved handle, light and dark themes, animations off under `prefers-reduced-motion`

## What I practiced

- **FLIP with the Web Animations API.** I record each row's `getBoundingClientRect().top` right before a state change, then in `useLayoutEffect` compare it with the new position and play `translateY(delta) → 0` with `element.animate()`. Measuring the *visual* position means it also works mid-animation and for the pointer drop, where the row is still offset by a transform.
- **Two drag models for two inputs.** Pointer drags keep the DOM order fixed and move rows with transforms from slot rects measured on press, so nothing reflows under the cursor. Keyboard drags render the previewed order for real, which is simpler but means React moves the focused node and focus is lost, so I restore it in a layout effect and ignore the blur that move causes.
- **Announcements that repeat.** A live region doesn't speak a message identical to the last one, so I toggle a trailing non-breaking space on each update; "Position unchanged" twice in a row is still read out.

## Run

```bash
npm install
npm run dev
```
