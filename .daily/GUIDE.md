# How a daily project is made

Rules followed by the scheduled job that adds one project per day.

## Rotation

Formats rotate by project number (`NNN`):

| NNN mod 4 | Format |
| --- | --- |
| 1 | 📱 Mini-app |
| 2 | 🧩 Component |
| 3 | 📝 TIL |
| 0 | 🧠 Algorithm |

## Folder

`projects/NNN-kebab-case-name/` with zero-padded number (001, 002, …). One project per day, never edit older projects.

## Stack

- Mini-app and Component: Vite + React 19 + TypeScript (strict). Same `package.json`, `tsconfig.json`, `vite.config.ts` shape as `001`.
- TIL: `README.md` plus a `examples/` folder of small `.ts`/`.tsx` files.
- Algorithm: `solution.ts` + `solution.test.ts` (Vitest) + README with approach and Big-O.

## Every project README has

1. `# NNN · Title`
2. Type, stack, date line
3. One-paragraph description
4. Features or key points
5. **What I practiced** — the real technical takeaway, 1–3 bullets
6. How to run

## Quality bar

- Pick a topic not already covered (check the root README table).
- Real, useful, idiomatic code. No placeholder or filler files.
- Accessible: keyboard support, focus styles, `prefers-reduced-motion` where there is animation.
- Run `npm install && npm run build` (and tests) when the registry is reachable; otherwise review types by hand.

## Finish

1. Add a row to the table in the root `README.md`.
2. One commit: `Day NNN: <Title> (<format>)`. The repo owner's rule: the commit message is only that line, with no `Co-Authored-By` or `Claude-Session` trailers.
3. Push to `main`.
