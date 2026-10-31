import { useEffect } from "react";
import { formatTime, useTimer } from "./useTimer";

const RADIUS = 120;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function App() {
  const { phase, remaining, running, completed, progress, toggle, reset, skip } =
    useTimer((finished) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(finished === "focus" ? "Focus done. Take a break 👻" : "Break over. Back to it 🎃");
      }
    });

  useEffect(() => {
    document.title = `${formatTime(remaining)} · ${phase === "focus" ? "Focus" : "Break"}`;
  }, [remaining, phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "r") reset();
      if (e.key === "s") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, reset, skip]);

  const requestNotifications = () => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  return (
    <main className={`app ${phase}`}>
      <h1 className="title">Haunted Focus Timer</h1>

      <div className="dial" aria-live="polite">
        <svg viewBox="0 0 280 280" className="ring">
          <circle cx="140" cy="140" r={RADIUS} className="ring-track" />
          <circle
            cx="140"
            cy="140"
            r={RADIUS}
            className="ring-progress"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div className="dial-center">
          <span className={`mascot ${running ? "floating" : ""}`} aria-hidden>
            {phase === "focus" ? "🎃" : "👻"}
          </span>
          <span className="time">{formatTime(remaining)}</span>
          <span className="phase">{phase === "focus" ? "focus" : "break"}</span>
        </div>
      </div>

      <div className="controls">
        <button onClick={reset} className="ghost-btn" title="Reset (R)">Reset</button>
        <button
          onClick={() => {
            requestNotifications();
            toggle();
          }}
          className="main-btn"
          title="Start / pause (Space)"
        >
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={skip} className="ghost-btn" title="Skip (S)">Skip</button>
      </div>

      <p className="tally" aria-label={`${completed} focus sessions completed`}>
        {completed === 0 ? "No pumpkins carved yet" : "🎃".repeat(Math.min(completed, 12))}
      </p>

      <p className="hint">Space: start/pause · R: reset · S: skip</p>
    </main>
  );
}
