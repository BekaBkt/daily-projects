import {
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import {
  backspaceAt,
  deleteAt,
  extractTyped,
  insertAt,
  maxFocus,
  sanitize,
  type Edit,
  type OtpKind,
} from "./otp";

export interface OtpInputHandle {
  /** Focus the first empty slot (or the last one when the code is full). */
  focus: () => void;
}

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires once each time the last slot gets filled. */
  onComplete?: (value: string) => void;
  label: string;
  length?: number;
  kind?: OtpKind;
  /** Visually split the slots into groups of this size, e.g. 3 → "123 456". */
  groupSize?: number;
  /** Field name for the hidden input, so the code submits with a plain form. */
  name?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  ref?: Ref<OtpInputHandle>;
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  label,
  length = 6,
  kind = "numeric",
  groupSize,
  name,
  description,
  error,
  disabled = false,
  autoFocus = false,
  ref,
}: OtpInputProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // Slot to focus after the parent re-renders with the new value.
  const pendingFocus = useRef<number | null>(null);

  const focusSlot = (index: number) => {
    const input = inputs.current[index];
    if (!input) return;
    input.focus();
    input.select();
  };

  useImperativeHandle(ref, () => ({ focus: () => focusSlot(maxFocus(value, length)) }), [value, length]);

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    focusSlot(pendingFocus.current);
    pendingFocus.current = null;
  });

  const apply = (edit: Edit) => {
    if (edit.value === value) {
      // No re-render is coming, so move focus now.
      focusSlot(edit.focus);
      return;
    }
    pendingFocus.current = edit.focus;
    onChange(edit.value);
    // Called from the event, not an effect, so StrictMode can't fire it twice.
    if (edit.value.length === length) onComplete?.(edit.value);
  };

  const handleChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === "") {
      // Android keyboards often skip keydown for Backspace and just empty the field.
      apply(deleteAt(value, index, length));
      return;
    }
    const typed = sanitize(extractTyped(raw, value[index] ?? "", length), kind);
    if (typed === "") {
      // Rejected character: React restores the controlled value; keep the selection.
      // (Guarded: Chrome's select() also focuses, which would steal focus on fast typing.)
      const input = event.target;
      requestAnimationFrame(() => {
        if (document.activeElement === input) input.select();
      });
      return;
    }
    apply(insertAt(value, index, typed, length));
  };

  const handlePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = sanitize(event.clipboardData.getData("text"), kind);
    if (pasted) apply(insertAt(value, index, pasted, length));
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    const last = maxFocus(value, length);
    let target: number | null = null;

    switch (event.key) {
      case "Backspace":
        event.preventDefault();
        apply(backspaceAt(value, index, length));
        return;
      case "Delete":
        event.preventDefault();
        apply(deleteAt(value, index, length));
        return;
      case "ArrowLeft":
        target = index - 1;
        break;
      case "ArrowRight":
        target = index + 1;
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = last;
        break;
      default:
        return;
    }

    event.preventDefault();
    focusSlot(Math.min(Math.max(target, 0), last));
  };

  const handleFocus = (index: number) => () => {
    // Slots past the first empty one can't hold a character yet, so redirect.
    const last = maxFocus(value, length);
    if (index > last) focusSlot(last);
    else inputs.current[index]?.select();
  };

  const describedBy = [description && descriptionId, error && errorId].filter(Boolean).join(" ") || undefined;
  const noun = kind === "numeric" ? "Digit" : "Character";

  return (
    <div className="otp" data-invalid={error ? "" : undefined} data-disabled={disabled ? "" : undefined}>
      <div id={labelId} className="otp__label">
        {label}
      </div>
      {description && (
        <p id={descriptionId} className="otp__description">
          {description}
        </p>
      )}

      <div className="otp__slots" role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? "";
          const groupEnd = groupSize !== undefined && (index + 1) % groupSize === 0 && index < length - 1;
          return (
            <span key={index} className="otp__cell">
              <input
                ref={(node) => {
                  inputs.current[index] = node;
                }}
                className="otp__slot"
                value={char}
                // One-time-code autofill (iOS SMS, password managers) targets the first field.
                autoComplete={index === 0 ? "one-time-code" : "off"}
                inputMode={kind === "numeric" ? "numeric" : "text"}
                autoCapitalize={kind === "alphanumeric" ? "characters" : "off"}
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={index === length - 1 ? "done" : "next"}
                aria-label={`${noun} ${index + 1} of ${length}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                data-filled={char ? "" : undefined}
                disabled={disabled}
                autoFocus={autoFocus && index === 0}
                onChange={handleChange(index)}
                onPaste={handlePaste(index)}
                onKeyDown={handleKeyDown(index)}
                onFocus={handleFocus(index)}
                onMouseUp={(event) => event.preventDefault()}
              />
              {groupEnd && (
                <span className="otp__separator" aria-hidden="true">
                  –
                </span>
              )}
            </span>
          );
        })}
      </div>

      {name && <input type="hidden" name={name} value={value} />}

      <p id={errorId} className="otp__error" role="alert">
        {error}
      </p>
    </div>
  );
}
