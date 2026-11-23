# 022 · Resizable Split Pane

**Type:** component · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-23

A resizable split layout built on the WAI-ARIA window splitter pattern. The divider is a focusable `separator` you can drag with a mouse, pen or finger, or move with the keyboard; a collapsible pane snaps shut when you drag past half its minimum and reopens at the size it had before. Panes nest, so the demo is a small IDE: a file sidebar on the side, and an editor stacked over a terminal, with a toggle to flip the whole thing to right-to-left.

## Features

- Props: `label`, `direction` (`row` / `column`), `defaultSize`, `defaultCollapsed`, `min`, `max`, `step`, `bigStep`, `collapsible`, `storageKey`, `onResize({ size, collapsed })`
- Keyboard: arrows move by `step`, `Shift` + arrow and `PageUp`/`PageDown` by `bigStep`, `Home`/`End` jump to min/max (min collapses when collapsible), `Enter` collapses and restores; double-click does the same for the mouse
- Arrow keys follow the visual direction, so in an RTL layout `←` grows the first pane, which sits on the right
- `aria-valuenow`/`min`/`max`, `aria-valuetext` (`"32%"` or `"Collapsed"`), `aria-controls` pointing at the pane it resizes and `aria-orientation` set to the line's own orientation
- Pointer capture for dragging, `touch-action: none` and a hit area wider than the visible gutter, so it works on touch screens
- A collapsed pane is `inert`, so Tab never lands on content you can't see
- Size and collapsed state optionally persist in `localStorage` (wrapped in `try/catch`, the component works without it)
- Keyboard moves animate the grid tracks; dragging and `prefers-reduced-motion` turn that off. Focus ring on the separator, light, dark and forced-colors styles

## What I practiced

- **Keeping the behaviour out of the component.** `split.ts` has a reducer over `{ size, collapsed, restoreSize }` and a `keyToAction` mapper, so "one more step down at the minimum collapses", "growing a collapsed pane opens it at the minimum" and the drag snap point are plain functions I could check without a DOM. The component only turns events into actions.
- **Remembering where to come back to.** A collapse has to know the size to restore, and it's different per path: the current size for `Enter`, the size at the start of the drag when you drag it shut (otherwise you'd restore to the minimum you passed on the way). Passing the drag origin inside the action kept that logic in the reducer instead of in refs.
- **Laying it out with one CSS variable.** The component only sets `--split-size`; the grid computes `calc((100% - gutter) * size / 100)` for the first track, so RTL comes for free from the grid's inline direction and nested splits don't need any measuring.

## Run

```bash
npm install
npm run dev
```
