import { useEffect, useId, useMemo, useState } from "react";
import { FIELD_LABELS, FIELD_ORDER, parseCron } from "./cron";
import { describeField, describeSchedule } from "./describe";
import { nextRuns } from "./schedule";

const PRESETS: { label: string; expr: string }[] = [
  { label: "Every 15 min", expr: "*/15 * * * *" },
  { label: "Weekdays 9:00", expr: "0 9 * * 1-5" },
  { label: "Office hours", expr: "0 9-17 * * mon-fri" },
  { label: "1st & 15th", expr: "0 0 1,15 * *" },
  { label: "Friday the 13th?", expr: "0 12 13 * 5" },
  { label: "Leap day", expr: "0 0 29 2 *" },
  { label: "@weekly", expr: "@weekly" },
];

const RUN_COUNT = 5;

function readHash(): string {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get("cron") ?? "0 9 * * 1-5";
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 525_600],
  ["month", 43_200],
  ["week", 10_080],
  ["day", 1_440],
  ["hour", 60],
  ["minute", 1],
];

function relative(target: Date, now: Date): string {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(minutes) >= size || unit === "minute") {
      return relativeFormat.format(Math.round(minutes / size), unit);
    }
  }
  return "";
}

/** Re-render once a minute, aligned to the clock, so "in 3 minutes" stays true. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);
  return now;
}

export function App() {
  const [expr, setExpr] = useState(readHash);
  const [copied, setCopied] = useState(false);
  const now = useMinuteClock();
  const inputId = useId();
  const messageId = useId();

  const result = useMemo(() => parseCron(expr), [expr]);
  const runs = useMemo(
    () => (result.ok ? nextRuns(result.schedule, now, RUN_COUNT) : []),
    [result, now],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.hash = new URLSearchParams({ cron: expr.trim() }).toString();
    window.history.replaceState(null, "", url);
  }, [expr]);

  useEffect(() => {
    const onHashChange = () => setExpr(readHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(expr.trim());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const tokens = expr.trim().startsWith("@") ? [] : expr.trim().split(/\s+/);
  const errorField = result.ok ? undefined : result.field;

  return (
    <main className="app">
      <header>
        <h1>Cron Explainer</h1>
        <p className="lede">Type a cron expression, read it in plain English, see when it fires next.</p>
      </header>

      <section aria-labelledby="expr-heading">
        <h2 id="expr-heading" className="visually-hidden">Expression</h2>
        <label htmlFor={inputId} className="field-label">Cron expression</label>
        <div className="input-row">
          <input
            id={inputId}
            className="expr-input"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            aria-invalid={!result.ok}
            aria-describedby={messageId}
          />
          <button type="button" className="button" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p
          id={messageId}
          className={result.ok ? "summary" : "summary summary--error"}
          aria-live="polite"
        >
          {result.ok ? describeSchedule(result.schedule) : result.error}
        </p>

        <div className="presets" role="group" aria-label="Examples">
          {PRESETS.map((preset) => (
            <button
              key={preset.expr}
              type="button"
              className="chip"
              aria-pressed={expr.trim() === preset.expr}
              onClick={() => setExpr(preset.expr)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="fields-heading">
        <h2 id="fields-heading">Fields</h2>
        <ol className="fields">
          {FIELD_ORDER.map((name, i) => {
            const field = result.ok ? result.schedule[name] : undefined;
            const token = field?.source ?? tokens[i] ?? "–";
            return (
              <li
                key={name}
                className={name === errorField ? "field field--error" : "field"}
              >
                <code className="field-token">{token}</code>
                <span className="field-name">{FIELD_LABELS[name]}</span>
                <span className="field-text">
                  {field ? describeField(field) : name === errorField ? "invalid" : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="runs-heading">
        <h2 id="runs-heading">Next {RUN_COUNT} runs</h2>
        <p className="hint">Local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        {result.ok && runs.length === 0 && (
          <p className="empty">This schedule never fires (no matching date in the next 5 years).</p>
        )}
        {runs.length > 0 && (
          <ol className="runs">
            {runs.map((run) => (
              <li key={run.getTime()}>
                <time dateTime={run.toISOString()}>{dateFormat.format(run)}</time>
                <span className="relative">{relative(run, now)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="syntax">
        <code>* , - /</code> any · list · range · step &nbsp;·&nbsp; names like <code>MON</code>,{" "}
        <code>JAN</code> &nbsp;·&nbsp; macros <code>@hourly</code> <code>@daily</code>{" "}
        <code>@weekly</code> <code>@monthly</code> <code>@yearly</code>
      </footer>
    </main>
  );
}
