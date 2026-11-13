import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createEasing, format, type Bezier } from "./bezier";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

const FRAMES = 11;

interface Props {
  value: Bezier;
  durationMs: number;
}

export function Preview({ value, durationMs }: Props) {
  const [atEnd, setAtEnd] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const easing = useMemo(() => createEasing(value), [value]);

  // Where the element is at evenly spaced moments in time: wide gaps = fast, bunched up = slow.
  const frames = useMemo(
    () => Array.from({ length: FRAMES }, (_, i) => easing(i / (FRAMES - 1))),
    [easing],
  );

  const style = {
    "--duration": `${durationMs}ms`,
    "--easing": format(value),
  } as CSSProperties;

  return (
    <section className="preview" aria-labelledby="preview-title" style={style}>
      <div className="preview-head">
        <h2 id="preview-title">Preview</h2>
        <button type="button" onClick={() => setAtEnd((v) => !v)}>
          {atEnd ? "Play back" : "Play"}
        </button>
      </div>
      {reducedMotion && (
        <p className="hint">
          Reduced motion is on, so the preview jumps instead of animating. The frames below show the
          timing without movement.
        </p>
      )}

      <div className="lanes" data-at-end={atEnd}>
        <div className="lane">
          <span className="lane-label">Your curve</span>
          <div className="lane-track">
            <div className="runner runner-custom">
              <span className="ball" />
            </div>
          </div>
        </div>
        <div className="lane">
          <span className="lane-label">linear</span>
          <div className="lane-track">
            <div className="runner runner-linear">
              <span className="ball" />
            </div>
          </div>
        </div>
      </div>

      <div className="frames">
        <span className="lane-label" id="frames-label">
          {FRAMES} frames, equal time apart
        </span>
        <div className="lane-track frames-track" role="img" aria-labelledby="frames-label frames-values">
          <div className="frames-inner">
            {frames.map((progress, i) => (
              <span
                key={i}
                className="frame"
                style={{ "--p": progress, "--i": i / (FRAMES - 1) } as CSSProperties}
              />
            ))}
          </div>
        </div>
        <span id="frames-values" className="visually-hidden">
          Progress at each frame: {frames.map((p) => `${Math.round(p * 100)}%`).join(", ")}
        </span>
      </div>
    </section>
  );
}
