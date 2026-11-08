# 009 · Cron Explainer

**Type:** mini-app · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-08

A cron expression playground. Type `*/15 9-17 * * mon-fri` and it tells you, in plain English, when that runs, breaks the expression into its five fields, and lists the next five fire times in your local time zone with a live "in 3 hours" countdown. Mistakes point at the exact field that is wrong instead of a generic "invalid".

## Features

- Hand-written parser for 5-field cron: `*`, lists, ranges, steps (`*/15`, `9-17/2`, `5/10`), month and weekday names, `7` as Sunday, and the `@hourly` / `@daily` / `@weekly` / `@monthly` / `@yearly` macros
- One-sentence description, e.g. `0 9-17 * * mon-fri` → "At minute 0, between 09:00 and 17:59, on Monday through Friday."
- Per-field breakdown with the failing field highlighted and a specific error ("Minute: 61 is outside 0–59.")
- Next five runs with `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat`, refreshed on the minute boundary
- Detects schedules that never fire (`0 0 30 2 *`)
- Presets as toggle chips (`aria-pressed`), copy button, expression stored in the URL hash for sharing
- Labelled input with `aria-invalid` / `aria-describedby`, visible focus rings, light/dark theme, respects `prefers-reduced-motion`

## What I practiced

- **Cron's day-of-month / day-of-week quirk.** When both fields are restricted, cron fires if *either* matches, so `0 12 13 * 5` is every Friday *and* every 13th, not Friday the 13th. Like Vixie cron, a field only counts as unrestricted when it starts with `*`, which means `*/2` in one of them switches back to AND.
- **Jumping instead of ticking.** `nextRuns` doesn't step minute by minute: a wrong month skips to the 1st of the next month, a wrong day to midnight, a wrong hour to `:00`. A leap-day schedule resolves in a few hundred iterations, and a five-year cap turns "never" into an empty list instead of an infinite loop.
- **Keeping the AST, not just the values.** Each field keeps its parsed parts (`start`, `end`, `step`, `star`) next to the expanded set, so the description can say "every 15 minutes" instead of listing `0, 15, 30, 45`.

## Run

```bash
npm install
npm run dev
```
