import { useId } from "react";
import { sizeAt, stepName, type Step } from "./fluid";

interface ChartProps {
  steps: Step[];
  minViewport: number;
  maxViewport: number;
  domain: [number, number];
  width: number;
}

const W = 560;
const H = 300;
const PAD = { top: 16, right: 64, bottom: 32, left: 44 };

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const nice = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return nice * magnitude;
}

function ticks(from: number, to: number, target: number): number[] {
  const step = niceStep(to - from, target);
  const out: number[] = [];
  for (let v = Math.ceil(from / step) * step; v <= to; v += step) out.push(v);
  return out;
}

export function Chart({ steps, minViewport, maxViewport, domain, width }: ChartProps) {
  const titleId = useId();
  const descId = useId();
  const [x0, x1] = domain;
  const yMax = Math.max(...steps.map((s) => Math.max(s.min, s.max))) * 1.08;

  const x = (vw: number) => PAD.left + ((vw - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const y = (px: number) => H - PAD.bottom - (px / yMax) * (H - PAD.top - PAD.bottom);

  // A clamp() is flat, then linear, then flat: four points draw it exactly.
  const path = (step: Step) =>
    [x0, minViewport, maxViewport, x1]
      .map((vw, i) => `${i === 0 ? "M" : "L"}${x(vw).toFixed(1)},${y(sizeAt(step, vw)).toFixed(1)}`)
      .join(" ");

  const top = steps[steps.length - 1];

  // Small steps sit a few px apart at the right edge; skip labels that would overlap.
  const labelled = new Set<number>();
  let lastY = -Infinity;
  for (const step of [...steps].sort((a, b) => sizeAt(a, x1) - sizeAt(b, x1))) {
    const labelY = y(sizeAt(step, x1));
    if (Math.abs(labelY - lastY) >= 13) {
      labelled.add(step.step);
      lastY = labelY;
    }
  }

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <title id={titleId}>Font size by viewport width</title>
      <desc id={descId}>
        Each step stays flat below {minViewport}px and above {maxViewport}px and grows linearly in
        between.
        {top ? ` The largest step goes from ${top.min.toFixed(1)}px to ${top.max.toFixed(1)}px.` : ""}
        {` The marker is at ${width}px.`}
      </desc>

      <rect
        className="chart-band"
        x={x(minViewport)}
        y={PAD.top}
        width={x(maxViewport) - x(minViewport)}
        height={H - PAD.top - PAD.bottom}
      />

      {ticks(0, yMax, 5).map((v) => (
        <g key={`y${v}`} className="chart-grid">
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
          <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
            {v}
          </text>
        </g>
      ))}
      {ticks(x0, x1, 6).map((v) => (
        <text key={`x${v}`} className="chart-axis" x={x(v)} y={H - PAD.bottom + 20} textAnchor="middle">
          {v}
        </text>
      ))}

      {steps.map((step) => (
        <g key={step.step} className={step.step === 0 ? "chart-step is-base" : "chart-step"}>
          <path d={path(step)} />
          {labelled.has(step.step) && (
            <text x={W - PAD.right + 6} y={y(sizeAt(step, x1))} dominantBaseline="middle">
              {stepName(step.step).slice(2)}
            </text>
          )}
        </g>
      ))}

      <line className="chart-marker" x1={x(width)} x2={x(width)} y1={PAD.top} y2={H - PAD.bottom} />
      {steps.map((step) => (
        <circle key={step.step} className="chart-dot" cx={x(width)} cy={y(sizeAt(step, width))} r={3} />
      ))}
    </svg>
  );
}
