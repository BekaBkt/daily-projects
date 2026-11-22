import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Chart } from "./Chart";
import {
  DEFAULT_DRAFT,
  RATIO_PRESETS,
  draftFromHash,
  draftToHash,
  parseDraft,
  type Draft,
  type Field,
} from "./config";
import { buildScale, formatNumber, sizeAt, stepName, toClamp, toCss, type ScaleConfig } from "./fluid";
import { checkZoom, MAX_ZOOM } from "./zoom";

const DEFAULT_CONFIG = (parseDraft(DEFAULT_DRAFT) as { ok: true; config: ScaleConfig }).config;

interface NumberFieldProps {
  field: Field;
  label: string;
  suffix?: string;
  step?: string;
  list?: string;
  draft: Draft;
  error?: string;
  onChange: (field: Field, value: string) => void;
}

function NumberField({ field, label, suffix, step = "any", list, draft, error, onChange }: NumberFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={error ? "field has-error" : "field"}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          list={list}
          value={draft[field]}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(field, e.target.value)}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </div>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="pair">{children}</div>
    </fieldset>
  );
}

export function App() {
  const [draft, setDraft] = useState<Draft>(() => draftFromHash(window.location.hash));
  const [width, setWidth] = useState(1024);
  const [sample, setSample] = useState("Fluid type, no breakpoints");
  const [status, setStatus] = useState("");
  const lastGood = useRef<ScaleConfig>(DEFAULT_CONFIG);
  const ratioListId = useId();
  const widthId = useId();
  const sampleId = useId();

  const parsed = parseDraft(draft);
  if (parsed.ok) lastGood.current = parsed.config;
  const config = lastGood.current;
  const errors = parsed.ok ? {} : parsed.errors;

  useEffect(() => {
    const hash = `#${draftToHash(draft)}`;
    if (hash !== window.location.hash) window.history.replaceState(null, "", hash);
  }, [draft]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  const steps = useMemo(() => buildScale(config), [config]);
  const checks = useMemo(() => new Map(steps.map((s) => [s.step, checkZoom(s)])), [steps]);
  const css = toCss(steps, draft.unit, config.rootSize);

  const domain: [number, number] = [
    Math.max(0, Math.round(config.minViewport - 0.25 * (config.maxViewport - config.minViewport))),
    Math.round(config.maxViewport + 0.25 * (config.maxViewport - config.minViewport)),
  ];
  const previewWidth = Math.min(domain[1], Math.max(domain[0], width));
  const failing = steps.filter((s) => !checks.get(s.step)?.passes);

  const update = (field: Field, value: string) => setDraft((d) => ({ ...d, [field]: value }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(css);
      setStatus("CSS copied to the clipboard.");
    } catch {
      setStatus("Couldn't copy. Select the code and copy it by hand.");
    }
  };

  const fieldProps = { draft, onChange: update };

  return (
    <div className="app">
      <header>
        <h1>Fluid Type Scale</h1>
        <p>
          Pick sizes for a small and a large screen and get a <code>clamp()</code> for every step of
          the scale, with a check that each one still passes 200% zoom.
        </p>
      </header>

      <main className="layout">
        <form className="settings" onSubmit={(e) => e.preventDefault()} aria-label="Scale settings">
          <Fieldset legend="Viewport">
            <NumberField field="minViewport" label="Min width" suffix="px" error={errors.minViewport} {...fieldProps} />
            <NumberField field="maxViewport" label="Max width" suffix="px" error={errors.maxViewport} {...fieldProps} />
          </Fieldset>
          <Fieldset legend="Base size (step 0)">
            <NumberField field="minBase" label="At min width" suffix="px" error={errors.minBase} {...fieldProps} />
            <NumberField field="maxBase" label="At max width" suffix="px" error={errors.maxBase} {...fieldProps} />
          </Fieldset>
          <Fieldset legend="Scale ratio">
            <NumberField field="minRatio" label="At min width" step="0.001" list={ratioListId} error={errors.minRatio} {...fieldProps} />
            <NumberField field="maxRatio" label="At max width" step="0.001" list={ratioListId} error={errors.maxRatio} {...fieldProps} />
            <datalist id={ratioListId}>
              {RATIO_PRESETS.map((p) => (
                <option key={p.value} value={p.value} label={p.label} />
              ))}
            </datalist>
          </Fieldset>
          <Fieldset legend="Steps">
            <NumberField field="stepsDown" label="Below base" step="1" error={errors.stepsDown} {...fieldProps} />
            <NumberField field="stepsUp" label="Above base" step="1" error={errors.stepsUp} {...fieldProps} />
          </Fieldset>
          <fieldset>
            <legend>Output</legend>
            <div className="pair">
              <div className="radios" role="radiogroup" aria-label="Unit">
                {(["rem", "px"] as const).map((unit) => (
                  <label key={unit} className="radio">
                    <input
                      type="radio"
                      name="unit"
                      value={unit}
                      checked={draft.unit === unit}
                      onChange={() => setDraft((d) => ({ ...d, unit }))}
                    />
                    <span>{unit}</span>
                  </label>
                ))}
              </div>
              <NumberField field="rootSize" label="1rem equals" suffix="px" error={errors.rootSize} {...fieldProps} />
            </div>
          </fieldset>
          <button type="button" className="ghost" onClick={() => setDraft(DEFAULT_DRAFT)}>
            Reset to defaults
          </button>
        </form>

        <div className={parsed.ok ? "results" : "results is-stale"}>
          {!parsed.ok && (
            <p className="stale-note" role="status">
              Fix the highlighted fields; showing the last valid scale.
            </p>
          )}

          <section aria-labelledby="preview-heading" className="card">
            <div className="card-head">
              <h2 id="preview-heading">Preview</h2>
              <div className="width-control">
                <label htmlFor={widthId}>Viewport</label>
                <input
                  id={widthId}
                  type="range"
                  min={domain[0]}
                  max={domain[1]}
                  step={1}
                  value={previewWidth}
                  aria-valuetext={`${previewWidth} pixels wide`}
                  onChange={(e) => setWidth(e.target.valueAsNumber)}
                />
                <output htmlFor={widthId}>{previewWidth}px</output>
              </div>
            </div>
            <Chart
              steps={steps}
              minViewport={config.minViewport}
              maxViewport={config.maxViewport}
              domain={domain}
              width={previewWidth}
            />
            <label className="sample-label" htmlFor={sampleId}>
              Sample text
            </label>
            <input id={sampleId} className="sample-input" value={sample} onChange={(e) => setSample(e.target.value)} />
            <ol className="specimens" reversed>
              {[...steps].reverse().map((step) => {
                const px = sizeAt(step, previewWidth);
                return (
                  <li key={step.step}>
                    <span className="specimen-meta">
                      <code>{stepName(step.step)}</code> {formatNumber(px, 1)}px
                    </span>
                    <span className="specimen-text" style={{ fontSize: `${px}px` }}>
                      {sample || "Aa"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="steps-heading" className="card">
            <h2 id="steps-heading">Steps</h2>
            <p className="hint">
              Zoom gain is the most a step can grow at up to {MAX_ZOOM * 100}% page zoom, at the window
              width where that is hardest. Under 2× fails{" "}
              <a href="https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html">WCAG 1.4.4</a>: the vw
              part of a clamp doesn't grow when you zoom.
            </p>
            <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="steps-heading">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    <th scope="col">Min</th>
                    <th scope="col">Max</th>
                    <th scope="col">clamp()</th>
                    <th scope="col">Zoom gain</th>
                  </tr>
                </thead>
                <tbody>
                  {[...steps].reverse().map((step) => {
                    const check = checks.get(step.step);
                    return (
                      <tr key={step.step} className={step.step === 0 ? "is-base" : undefined}>
                        <th scope="row">
                          <code>{stepName(step.step)}</code>
                        </th>
                        <td>{formatNumber(step.min, 2)}px</td>
                        <td>{formatNumber(step.max, 2)}px</td>
                        <td>
                          <code>{toClamp(step, draft.unit, config.rootSize)}</code>
                        </td>
                        <td>
                          {check && (
                            <span className={check.passes ? "badge pass" : "badge fail"}>
                              {formatNumber(check.gain, 2)}×
                              <span className="visually-hidden">
                                {check.passes ? ", passes" : `, fails at ${check.width}px wide`}
                              </span>
                              <span aria-hidden="true">{check.passes ? " ✓" : ` ✗ ${check.width}px`}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {failing.length > 0 && (
              <p className="warning">
                {failing.length === 1 ? "One step grows" : `${failing.length} steps grow`} more than 2.5×
                between the two viewports. Lower the max size or raise the min size to keep zoom working.
              </p>
            )}
          </section>

          <section aria-labelledby="css-heading" className="card">
            <div className="card-head">
              <h2 id="css-heading">CSS</h2>
              <button type="button" onClick={copy}>
                Copy CSS
              </button>
            </div>
            <pre tabIndex={0} aria-labelledby="css-heading">
              <code>{css}</code>
            </pre>
            <p className="copy-status" role="status">
              {status}
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
