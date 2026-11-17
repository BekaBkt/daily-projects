import { useDeferredValue, useId, useMemo, useRef, useState } from "react";
import { emit, type EmitOptions, type EmitResult } from "./emit";
import { infer } from "./infer";
import { parseJson } from "./parse";
import { SAMPLE } from "./sample";

const DEFAULT_OPTIONS: EmitOptions = {
  rootName: "Order",
  declaration: "interface",
  readonly: false,
  exported: true,
};

export function App() {
  const [text, setText] = useState(SAMPLE);
  const [options, setOptions] = useState<EmitOptions>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ids = { input: useId(), error: useId(), root: useId(), output: useId() };

  // Big pastes shouldn't block typing: inference runs on the deferred copy.
  const deferredText = useDeferredValue(text);
  const parsed = useMemo(() => parseJson(deferredText), [deferredText]);
  const result = useMemo(
    () => (parsed.ok ? emit(infer(parsed.value), options) : null),
    [parsed, options],
  );
  // While the JSON is mid-edit and invalid, keep showing the last good output.
  // Updating state during render is React's pattern for "remember the previous value".
  const [lastGood, setLastGood] = useState<EmitResult | null>(result);
  if (result && result !== lastGood) setLastGood(result);
  const shown = result ?? (deferredText.trim() ? lastGood : null);
  const stale = !result && shown !== null;

  const set = <K extends keyof EmitOptions>(key: K, value: EmitOptions[K]) =>
    setOptions((current) => ({ ...current, [key]: value }));

  const replaceText = (next: string, message: string) => {
    setText(next);
    setStatus(message);
    inputRef.current?.focus();
  };

  const format = () => {
    if (parsed.ok) replaceText(JSON.stringify(parsed.value, null, 2), "Formatted the JSON.");
  };

  const jumpToError = () => {
    const input = inputRef.current;
    if (!input || parsed.ok || parsed.line === undefined) return;
    const lines = deferredText.split("\n");
    const offset =
      lines.slice(0, parsed.line - 1).reduce((sum, line) => sum + line.length + 1, 0) +
      (parsed.column ?? 1) -
      1;
    input.focus();
    input.setSelectionRange(offset, Math.min(offset + 1, deferredText.length));
  };

  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown.code);
      setStatus(`Copied ${plural(shown.count, "declaration")}.`);
    } catch {
      setStatus("Couldn't reach the clipboard. Select the output and copy it instead.");
    }
  };

  return (
    <main className="app">
      <header>
        <h1>JSON to TypeScript</h1>
        <p className="lede">
          Paste a JSON response, get the <code>interface</code>s for it. Arrays are merged, so keys
          that only some items have come out optional.
        </p>
      </header>

      <fieldset className="options">
        <legend className="visually-hidden">Output options</legend>
        <div className="field">
          <label htmlFor={ids.root}>Root name</label>
          <input
            id={ids.root}
            value={options.rootName}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => set("rootName", event.target.value)}
          />
        </div>
        <div className="segmented" role="radiogroup" aria-label="Declaration style">
          {(["interface", "type"] as const).map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name="declaration"
                value={kind}
                checked={options.declaration === kind}
                onChange={() => set("declaration", kind)}
              />
              <span>{kind}</span>
            </label>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={options.readonly}
            onChange={(event) => set("readonly", event.target.checked)}
          />
          readonly
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={options.exported}
            onChange={(event) => set("exported", event.target.checked)}
          />
          export
        </label>
      </fieldset>

      <div className="layout">
        <section className="panel" aria-labelledby="input-title">
          <div className="panel-head">
            <h2 id="input-title">
              <label htmlFor={ids.input}>JSON</label>
            </h2>
            <div className="actions">
              <button type="button" onClick={() => replaceText(SAMPLE, "Loaded the sample order.")}>
                Sample
              </button>
              <button type="button" onClick={format} disabled={!parsed.ok}>
                Format
              </button>
              <button type="button" onClick={() => replaceText("", "Cleared the input.")}>
                Clear
              </button>
            </div>
          </div>
          <textarea
            ref={inputRef}
            id={ids.input}
            className="code input"
            value={text}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!parsed.ok && text.trim() !== ""}
            aria-describedby={parsed.ok ? undefined : ids.error}
            onChange={(event) => setText(event.target.value)}
          />
          {!parsed.ok && (
            <p id={ids.error} className={text.trim() ? "error" : "hint"}>
              {parsed.line !== undefined && (
                <button type="button" className="link" onClick={jumpToError}>
                  Line {parsed.line}, column {parsed.column}
                </button>
              )}{" "}
              {parsed.message}
            </p>
          )}
        </section>

        <section className="panel" aria-labelledby="output-title">
          <div className="panel-head">
            <h2 id="output-title">TypeScript</h2>
            <div className="actions">
              <span className="meta">{shown ? plural(shown.count, "declaration") : ""}</span>
              <button type="button" className="primary" onClick={copy} disabled={!shown}>
                Copy
              </button>
            </div>
          </div>
          {stale && <p className="hint">Showing types from the last valid JSON.</p>}
          <pre
            id={ids.output}
            className={stale ? "code output stale" : "code output"}
            tabIndex={0}
            aria-labelledby="output-title"
          >
            <code>{shown?.code ?? ""}</code>
          </pre>
        </section>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
    </main>
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
