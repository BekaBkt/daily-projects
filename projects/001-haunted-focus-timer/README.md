# 001 · Haunted Focus Timer

**Type:** mini-app · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-10-31

A Halloween-themed Pomodoro timer: 25 minutes of focus, 5 minutes of break, with an animated progress ring and a pumpkin tally for finished sessions.

## Features

- SVG progress ring driven by `stroke-dashoffset`
- Keyboard shortcuts: `Space` start/pause, `R` reset, `S` skip
- Browser notification when a phase ends
- Remaining time shown in the tab title
- Respects `prefers-reduced-motion`

## What I practiced

- **Timestamp-based timers.** Browsers throttle `setInterval` in background tabs, so counting down by decrementing a number drifts. The `useTimer` hook stores the end timestamp and recalculates the remaining time on each tick, so it stays accurate.
- **Theming with CSS custom properties.** One `--accent` variable switches between focus and break colors for the whole UI.

## Run

```bash
npm install
npm run dev
```
