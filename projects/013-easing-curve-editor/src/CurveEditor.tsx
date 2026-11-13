import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Y_MAX, Y_MIN, normalize, round, type Bezier } from "./bezier";

// One unit of the curve (0 → 1) is 200 SVG units; y gets extra room for overshoot.
const UNIT = 200;
const PAD = 24;
const WIDTH = UNIT + PAD * 2;
const HEIGHT = (Y_MAX - Y_MIN) * UNIT + PAD * 2;

const toSvg = (x: number, y: number) => [PAD + x * UNIT, PAD + (Y_MAX - y) * UNIT] as const;
const fromSvg = (px: number, py: number) => [(px - PAD) / UNIT, Y_MAX - (py - PAD) / UNIT] as const;

const GRID = [0, 0.25, 0.5, 0.75, 1];

interface Props {
  value: Bezier;
  onChange: (next: Bezier) => void;
}

export function CurveEditor({ value, onChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<0 | 1 | null>(null);
  const [x1, y1, x2, y2] = value;

  const [ox, oy] = toSvg(0, 0);
  const [ex, ey] = toSvg(1, 1);
  const [p1x, p1y] = toSvg(x1, y1);
  const [p2x, p2y] = toSvg(x2, y2);

  const setPoint = (index: 0 | 1, x: number, y: number) => {
    const next: [number, number, number, number] = [...value];
    next[index * 2] = x;
    next[index * 2 + 1] = y;
    onChange(normalize(next));
  };

  const handleKeyDown = (index: 0 | 1) => (event: KeyboardEvent<SVGGElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setPoint(index, value[index * 2] + move[0], value[index * 2 + 1] + move[1]);
  };

  const handlePointerDown = (index: 0 | 1) => (event: PointerEvent<SVGGElement>) => {
    if (event.button !== 0) return;
    // Capture keeps the drag alive when the pointer leaves the handle (or the window).
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    dragging.current = index;
  };

  const handlePointerMove = (event: PointerEvent<SVGGElement>) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (dragging.current === null || !matrix) return;
    // Client pixels → SVG user units, whatever the CSS size of the <svg> is.
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const [x, y] = fromSvg(point.x, point.y);
    setPoint(dragging.current, x, y);
  };

  const stopDragging = () => {
    dragging.current = null;
  };

  const handle = (index: 0 | 1, cx: number, cy: number, x: number, y: number) => (
    <g
      className="handle"
      role="slider"
      tabIndex={0}
      aria-label={index === 0 ? "Start control point" : "End control point"}
      aria-describedby="handle-help"
      aria-valuemin={Y_MIN}
      aria-valuemax={Y_MAX}
      aria-valuenow={round(y)}
      aria-valuetext={`x ${round(x)}, y ${round(y)}`}
      onKeyDown={handleKeyDown(index)}
      onPointerDown={handlePointerDown(index)}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
    >
      <circle className="handle-hit" cx={cx} cy={cy} r={18} />
      <circle className={`handle-dot handle-dot-${index + 1}`} cx={cx} cy={cy} r={8} />
    </g>
  );

  return (
    <figure className="editor">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="editor-svg"
        aria-labelledby="editor-caption"
      >
        <rect className="plot" x={ox} y={ey} width={UNIT} height={UNIT} />
        {GRID.map((g) => {
          const [gx] = toSvg(g, 0);
          const [, gy] = toSvg(0, g);
          return (
            <g key={g} className="grid">
              <line x1={gx} y1={PAD} x2={gx} y2={HEIGHT - PAD} />
              <line x1={ox} y1={gy} x2={ex} y2={gy} />
            </g>
          );
        })}
        <text className="axis-label" x={ex} y={oy + 16} textAnchor="end">
          time →
        </text>
        <text className="axis-label" x={ox - 6} y={ey - 8}>
          progress ↑
        </text>
        <line className="linear" x1={ox} y1={oy} x2={ex} y2={ey} />
        <line className="arm" x1={ox} y1={oy} x2={p1x} y2={p1y} />
        <line className="arm" x1={ex} y1={ey} x2={p2x} y2={p2y} />
        <path className="curve" d={`M ${ox} ${oy} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${ex} ${ey}`} />
        <circle className="anchor" cx={ox} cy={oy} r={4} />
        <circle className="anchor" cx={ex} cy={ey} r={4} />
        {handle(0, p1x, p1y, x1, y1)}
        {handle(1, p2x, p2y, x2, y2)}
      </svg>
      <figcaption id="editor-caption" className="visually-hidden">
        Easing curve from start to end. Drag or use arrow keys on the two control points.
      </figcaption>
      <p id="handle-help" className="hint">
        Drag the dots, or focus one and use arrow keys (<kbd>Shift</kbd> for steps of 0.1).
      </p>
    </figure>
  );
}
