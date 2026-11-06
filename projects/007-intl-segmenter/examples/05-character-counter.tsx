// 05 · A textarea with a character limit that counts what the user sees.
//
// Typecheck-only example (React isn't run here). The native `maxLength` attribute
// counts UTF-16 code units, so a 280-"character" bio fills up after 35 family
// emoji, and a paste can be cut mid-emoji. This version counts graphemes,
// clips pastes on a grapheme boundary, and announces the limit politely.
import { useId, useMemo, useState, type ChangeEvent } from "react";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Count graphemes and, if over `max`, the code-unit offset where the text must be cut. */
function measure(text: string, max: number): { count: number; cutAt: number | null } {
  let count = 0;
  for (const { index } of segmenter.segment(text)) {
    if (count === max) return { count: max + 1, cutAt: index };
    count++;
  }
  return { count, cutAt: null };
}

export function useGraphemeLimit(max: number, initial = "") {
  const [value, setValue] = useState(() => {
    const { cutAt } = measure(initial, max);
    return cutAt === null ? initial : initial.slice(0, cutAt);
  });

  // Typing never needs more than max + 1 segments, so this stays cheap.
  const count = useMemo(() => measure(value, max).count, [value, max]);

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    const { cutAt } = measure(next, max);
    setValue(cutAt === null ? next : next.slice(0, cutAt));
  }

  return { value, onChange, count, remaining: max - count };
}

export function BioField({ max = 160 }: { max?: number }) {
  const { value, onChange, remaining } = useGraphemeLimit(max);
  const id = useId();
  const counterId = `${id}-counter`;
  const nearLimit = remaining <= 10;

  return (
    <div className="field">
      <label htmlFor={id}>Bio</label>
      <textarea id={id} value={value} onChange={onChange} rows={3} aria-describedby={counterId} />
      {/* Visible every keystroke, but only announced near the limit to avoid chatter. */}
      <p id={counterId} className={nearLimit ? "counter counter--warn" : "counter"}>
        {remaining} characters left
      </p>
      <p className="visually-hidden" aria-live="polite">
        {nearLimit ? `${remaining} characters left` : ""}
      </p>
    </div>
  );
}
