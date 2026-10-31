import { useCallback, useEffect, useRef, useState } from "react";

export type Phase = "focus" | "break";

export const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  break: 5 * 60,
};

/**
 * Pomodoro-style timer driven by timestamps instead of a decrementing counter,
 * so it stays accurate when the tab is backgrounded and setInterval is throttled.
 */
export function useTimer(onPhaseEnd?: (finished: Phase) => void) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);

  const endsAt = useRef<number | null>(null);
  const onEnd = useRef(onPhaseEnd);
  onEnd.current = onPhaseEnd;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!running) return;
    endsAt.current = Date.now() + remaining * 1000;

    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current! - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(id);
        setRunning(false);
        // Side effects stay outside state updaters: StrictMode runs updaters twice.
        const current = phaseRef.current;
        const next: Phase = current === "focus" ? "break" : "focus";
        if (current === "focus") setCompleted((n) => n + 1);
        onEnd.current?.(current);
        setPhase(next);
        setRemaining(DURATIONS[next]);
      }
    }, 250);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only on toggle
  }, [running]);

  const toggle = useCallback(() => setRunning((r) => !r), []);

  const reset = useCallback(() => {
    setRunning(false);
    setRemaining(DURATIONS[phase]);
  }, [phase]);

  const skip = useCallback(() => {
    setRunning(false);
    const next: Phase = phase === "focus" ? "break" : "focus";
    setPhase(next);
    setRemaining(DURATIONS[next]);
  }, [phase]);

  const progress = 1 - remaining / DURATIONS[phase];

  return { phase, remaining, running, completed, progress, toggle, reset, skip };
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
