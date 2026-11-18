# 018 · Tree View

**Type:** component · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-18

A file-explorer tree that follows the WAI-ARIA tree view pattern: the whole tree is one tab stop, arrow keys move through what's visible, `→`/`←` open, close and walk between parent and child, and typing jumps to items by name. Folders can load their contents on demand, with a loading state, an error state that turns the next expand into a retry, and an "empty" hint. The demo is a small project explorer where `node_modules` is slow, `shared-drive` fails on the first try and `drafts` comes back empty.

## Features

- Props: `label`, `nodes`, `selectedId`, `onSelect(node, path)`, `defaultExpanded`, `loadChildren(node, signal)`, `renderIcon(row)`
- Keyboard: `↑`/`↓`, `→` (open or go to first child), `←` (close or go to parent), `Home`/`End`, `Enter`/`Space` to select, `*` to open every sibling folder
- Typeahead with a 500 ms buffer: `"ro"` refines the match, `"rrr"` cycles through items starting with `r`
- Roving `tabindex`, so Tab leaves the tree in one step and comes back to the last item you were on
- Flat DOM with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`, `aria-selected` and `aria-busy` while a folder loads; load results are announced in a polite live region
- Lazy loads are cancelled with `AbortController` on unmount, and an in-flight load is never started twice
- Indent guides drawn with one background gradient per row, visible `:focus-visible` ring, light and dark themes; the chevron transition and spinner stop under `prefers-reduced-motion`

## What I practiced

- **Separating "what does this key do" from React.** `tree.ts` flattens the tree into visible rows (skipping collapsed subtrees) and `resolveKey(key, rows, focusedId)` returns an action like `{ type: "expand" }` or `{ type: "focus", id }`. Because every row already knows its level, parent and position in its set, `←`, `→` and `*` turned into small lookups, and I could test the whole keyboard model without a DOM.
- **Keeping the single tab stop valid.** If you collapse a folder with the mouse while focus is deep inside it, the focused row unmounts and focus drops to `<body>`. I derive the active row by walking up a parent map to the nearest visible ancestor, and only move DOM focus in `useLayoutEffect` when the change came from the keyboard or focus was already in the tree.
- **Making async children feel like part of the tree.** Loaded children live in a map next to the original data, so `childrenOf` merges both and the rest of the code doesn't care where a node came from. A failed load collapses the folder again, so pressing `→` is the retry and I didn't need a separate button inside a `treeitem`.

## Run

```bash
npm install
npm run dev
```
