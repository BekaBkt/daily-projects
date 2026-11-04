import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  LEVELS,
  contrastRatio,
  formatRatio,
  normalizeHex,
  parseHex,
  suggestFix,
} from "./color";

const FULL_HEX_RE = /^#?[0-9a-f]{6}$/i;
const DEFAULTS = { fg: "#8a8f98", bg: "#ffffff" };

function readHash(): { fg: string; bg: string } {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return {
    fg: normalizeHex(params.get("fg") ?? "") ?? DEFAULTS.fg,
    bg: normalizeHex(params.get("bg") ?? "") ?? DEFAULTS.bg,
  };
}

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (hex: string) => void;
};

/** Native colour picker plus a hex text field that only commits valid values. */
function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const invalid = normalizeHex(draft) === null;

  // Keep the text in sync when the value changes from outside (swap, fix, picker).
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-row">
        <input
          type="color"
          value={value}
          aria-label={`${label} picker`}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={id}
          type="text"
          spellCheck={false}
          autoComplete="off"
          value={draft}
          aria-invalid={invalid}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            // Commit full 6-digit values while typing; short #rgb is expanded on blur,
            // otherwise "#abc" would turn into "#aabbcc" halfway through typing "#abcdef".
            if (FULL_HEX_RE.test(e.target.value.trim())) onChange(normalizeHex(e.target.value)!);
          }}
          onBlur={() => {
            const hex = normalizeHex(draft);
            if (hex && hex !== value) onChange(hex);
            else setDraft(value);
          }}
        />
      </div>
      {invalid && (
        <p id={`${id}-error`} className="error">
          Use #rgb or #rrggbb
        </p>
      )}
    </div>
  );
}

export function App() {
  const [{ fg, bg }, setColors] = useState(readHash);
  const [targetId, setTargetId] = useState("aa");

  // Shareable state: the URL always reflects the current pair.
  useEffect(() => {
    history.replaceState(null, "", `#fg=${fg.slice(1)}&bg=${bg.slice(1)}`);
  }, [fg, bg]);

  useEffect(() => {
    const onHash = () => setColors(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const fgRgb = parseHex(fg)!;
  const bgRgb = parseHex(bg)!;
  const ratio = contrastRatio(fgRgb, bgRgb);
  const target = LEVELS.find((l) => l.id === targetId)!;

  // Each search converts a few hundred colours, so only rerun it when the inputs change.
  const fixes = useMemo(() => {
    const a = parseHex(fg)!;
    const b = parseHex(bg)!;
    return { text: suggestFix(a, b, target.min), background: suggestFix(b, a, target.min) };
  }, [fg, bg, target.min]);

  const setFg = (hex: string) => setColors((c) => ({ ...c, fg: hex }));
  const setBg = (hex: string) => setColors((c) => ({ ...c, bg: hex }));

  return (
    <main className="app" style={{ "--fg": fg, "--bg": bg } as CSSProperties}>
      <header>
        <h1>Contrast Fixer</h1>
        <p className="lede">
          Check a text/background pair against WCAG 2.2 and get the closest colour that passes.
        </p>
      </header>

      <section className="controls" aria-label="Colours">
        <ColorField label="Text" value={fg} onChange={setFg} />
        <button
          type="button"
          className="swap"
          onClick={() => setColors({ fg: bg, bg: fg })}
          aria-label="Swap text and background"
          title="Swap"
        >
          ⇄
        </button>
        <ColorField label="Background" value={bg} onChange={setBg} />
      </section>

      <section className="preview" aria-label="Preview">
        <p className="preview-large">Large text, 24px</p>
        <p>
          Body text at 16px. The quick brown fox jumps over the lazy dog, then checks its contrast
          ratio before shipping.
        </p>
        <span className="preview-ui" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" strokeWidth="2.5" />
          </svg>
          Button outline
        </span>
      </section>

      <section className="results" aria-label="Results">
        <p className="ratio" aria-live="polite">
          <span className="ratio-value">{formatRatio(ratio)}</span>
          <span className="ratio-label">contrast ratio</span>
        </p>
        <ul className="levels">
          {LEVELS.map((level) => {
            const pass = ratio >= level.min;
            return (
              <li key={level.id} className={pass ? "pass" : "fail"}>
                <span>{level.label}</span>
                <span className="badge">
                  {pass ? "Pass" : "Fail"} <small>≥ {level.min}</small>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="fix" aria-labelledby="fix-title">
        <div className="fix-head">
          <h2 id="fix-title">Fix it</h2>
          <label>
            Target{" "}
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} ({l.min}:1)
                </option>
              ))}
            </select>
          </label>
        </div>

        {fixes.text === null ? (
          <p className="ok">This pair already meets {target.label}.</p>
        ) : (
          <div className="fix-grid">
            <FixCard title="Adjust text" fix={fixes.text} other={bg} asText onApply={setFg} />
            <FixCard title="Adjust background" fix={fixes.background} other={fg} onApply={setBg} />
          </div>
        )}
        <p className="hint">
          Fixes keep the hue and chroma in OKLCH and only move lightness, so the colour still
          feels like your brand.
        </p>
      </section>
    </main>
  );
}

type FixCardProps = {
  title: string;
  fix: ReturnType<typeof suggestFix>;
  other: string;
  asText?: boolean;
  onApply: (hex: string) => void;
};

function FixCard({ title, fix, other, asText = false, onApply }: FixCardProps) {
  if (!fix) return null;
  const swatch = asText ? { color: fix.hex, background: other } : { color: other, background: fix.hex };
  return (
    <div className="fix-card">
      <div className="fix-swatch" style={swatch}>
        Aa
      </div>
      <div className="fix-body">
        <h3>{title}</h3>
        <p>
          <code>{fix.hex}</code> · {formatRatio(fix.ratio)}
        </p>
        <button type="button" onClick={() => onApply(fix.hex)}>
          Apply
        </button>
      </div>
    </div>
  );
}
