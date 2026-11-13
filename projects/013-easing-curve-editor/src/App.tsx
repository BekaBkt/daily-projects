import { useEffect, useId, useState } from "react";
import { CurveEditor } from "./CurveEditor";
import { Preview } from "./Preview";
import { format, keywordFor, parse, reverse, round, sameCurve, type Bezier } from "./bezier";
import { PRESETS } from "./presets";

const DEFAULT: Bezier = [0.25, 0.1, 0.25, 1];

function readHash(): Bezier {
  const result = parse(decodeURIComponent(window.location.hash.slice(1)));
  return result.ok ? result.value : DEFAULT;
}

export function App() {
  const [curve, setCurve] = useState<Bezier>(readHash);
  const [draft, setDraft] = useState(() => format(curve));
  const [duration, setDuration] = useState(800);
  const [status, setStatus] = useState("");
  const inputId = useId();
  const errorId = useId();

  const parsed = parse(draft);
  const keyword = keywordFor(curve);
  const css = format(curve);

  // Short, shareable hash: #0.25,0.1,0.25,1
  useEffect(() => {
    window.history.replaceState(null, "", `#${curve.map((v) => round(v)).join(",")}`);
  }, [curve]);

  const update = (next: Bezier) => {
    setCurve(next);
    setDraft(format(next));
    setStatus("");
  };

  const handleDraftChange = (text: string) => {
    setDraft(text);
    const result = parse(text);
    if (result.ok) setCurve(result.value);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setStatus(`Copied ${css}`);
    } catch {
      setStatus("Couldn't reach the clipboard. Select the text field and copy it instead.");
    }
  };

  return (
    <main className="app">
      <header>
        <h1>Easing Curve Editor</h1>
        <p className="lede">
          Shape a <code>cubic-bezier()</code> timing function, watch it next to linear, copy the CSS.
        </p>
      </header>

      <div className="layout">
        <CurveEditor value={curve} onChange={update} />

        <div className="side">
          <section className="panel" aria-labelledby="value-title">
            <h2 id="value-title">Value</h2>
            <label htmlFor={inputId}>CSS timing function</label>
            <div className="row">
              <input
                id={inputId}
                className="value-input"
                value={draft}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!parsed.ok}
                aria-describedby={parsed.ok ? undefined : errorId}
                onChange={(event) => handleDraftChange(event.target.value)}
                onBlur={() => parsed.ok && setDraft(format(parsed.value))}
              />
              <button type="button" onClick={copy}>
                Copy
              </button>
            </div>
            {!parsed.ok && (
              <p id={errorId} className="error">
                {parsed.error}
              </p>
            )}
            <p className="meta">
              {keyword ? (
                <>
                  Same as the <code>{keyword}</code> keyword.
                </>
              ) : (
                "Custom curve."
              )}{" "}
              <button type="button" className="link-button" onClick={() => update(reverse(curve))}>
                Reverse it
              </button>
            </p>
            <p className="status" role="status">
              {status}
            </p>
          </section>

          <section className="panel" aria-labelledby="presets-title">
            <h2 id="presets-title">Presets</h2>
            <div className="chips">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="chip"
                  aria-pressed={sameCurve(preset.value, curve)}
                  onClick={() => update(preset.value)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel" aria-labelledby="duration-title">
            <h2 id="duration-title">Duration</h2>
            <div className="row">
              <input
                type="range"
                min={200}
                max={3000}
                step={100}
                value={duration}
                aria-labelledby="duration-title"
                aria-valuetext={`${duration} milliseconds`}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
              <output>{duration} ms</output>
            </div>
          </section>

          <Preview value={curve} durationMs={duration} />
        </div>
      </div>
    </main>
  );
}
