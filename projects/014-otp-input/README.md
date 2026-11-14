# 014 · One-Time Code Input

**Type:** component · **Stack:** React 19, TypeScript, Vite · **Date:** 2026-11-14

A segmented input for verification and recovery codes: one box per character, but editing that behaves like a single text field. You can type, paste the code into any box, let iOS or a password manager autofill it from an SMS, and fix a typo in the middle without the code falling apart. The demo has an email verification flow (wrong code → shake, announced error, focus back to the start; resend countdown) and an 8-character recovery code inside a plain `<form>` that submits through a hidden input.

## Features

- Controlled API: `value`, `onChange`, `onComplete`, `length`, `kind` (`"numeric"` or `"alphanumeric"`), `groupSize`, `name`, `description`, `error`, `disabled`, plus a `ref` with `focus()`
- Paste anywhere: input is sanitized (`"428 913"`, `"k7q2-m9xd"`, full-width digits), and a full-length paste replaces the whole code regardless of which box is focused
- `autocomplete="one-time-code"` on the first box; an autofilled code is spread across all boxes
- Keyboard: `←`/`→`, `Home`/`End`, `Backspace` clears the box or steps back, `Delete` removes in place, typing over a filled box replaces it
- You can't land on a box past the first empty one: clicks and tabs get redirected there
- `role="group"` labelled by the field label, each box named "Digit 3 of 6", errors linked with `aria-describedby` and announced through `role="alert"`
- Visible focus state and a fake caret in the empty box; caret blink, transitions and the shake are off under `prefers-reduced-motion`

## What I practiced

- **Keeping the editing rules out of React.** All the logic lives in `otp.ts` as pure functions that take `(value, index)` and return `{ value, focus }`. The value is a compact string with no holes, so deleting the middle digit shifts the rest left like a real input. That made the component just a mapping from DOM events to those functions.
- **Reading what the browser actually typed.** A one-character input's `onChange` gives the old character plus the new one on whichever side the caret was, or a whole code from autofill, or an empty string when an Android keyboard sends Backspace without a usable `keydown`. `extractTyped` diffs against the previous character and treats each case explicitly.
- **Moving focus after a controlled update.** Focusing the next box inside the handler runs before the parent re-renders, so my own "can't go past the first empty box" check would bounce it back. I store the target in a ref and focus it in `useLayoutEffect`, except when the value didn't change and no render is coming. I also found that Chrome's `select()` focuses the element, which stole focus during fast typing until I guarded it.

## Run

```bash
npm install
npm run dev
```
