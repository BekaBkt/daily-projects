import { useState } from "react";
import { SortableList, arrayMove } from "./SortableList";

interface Task {
  id: string;
  title: string;
  note?: string;
  tag: "bug" | "feature" | "chore";
}

interface Track {
  id: string;
  title: string;
  artist: string;
  seconds: number;
}

const BACKLOG: Task[] = [
  { id: "t1", title: "Fix focus trap in checkout modal", tag: "bug" },
  {
    id: "t2",
    title: "Saved searches",
    note: "Let people pin a filter set and get a badge when new results match. Needs a small API change.",
    tag: "feature",
  },
  { id: "t3", title: "Upgrade to Vite 7", tag: "chore" },
  { id: "t4", title: "Dark mode for charts", note: "Series colors fail contrast on the dark surface.", tag: "feature" },
  { id: "t5", title: "Date picker skips a day in UTC−3", tag: "bug" },
  { id: "t6", title: "Remove unused icon sets", tag: "chore" },
];

const SET_LIST: Track[] = [
  { id: "s1", title: "Night Ferry", artist: "Kadıköy Kites", seconds: 214 },
  { id: "s2", title: "Low Tide Radio", artist: "Moda Club", seconds: 187 },
  { id: "s3", title: "Copper Stairs", artist: "Balat Brass", seconds: 342 },
  { id: "s4", title: "Simit at 3am", artist: "The Ferries", seconds: 158 },
  { id: "s5", title: "Lighthouse, Slowly", artist: "Fener Strings", seconds: 276 },
];

const DOORS_OPEN = 20 * 3600; // 20:00, in seconds

const clock = (s: number) => {
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function App() {
  const [tasks, setTasks] = useState(BACKLOG);
  const [tracks, setTracks] = useState(SET_LIST);
  const [lastMove, setLastMove] = useState<string | null>(null);

  // Cheap enough to recompute per row; a set list is a handful of tracks.
  const startTimes = (order: readonly Track[]) => {
    const starts = new Map<string, number>();
    let t = DOORS_OPEN;
    for (const track of order) {
      starts.set(track.id, t);
      t += track.seconds;
    }
    return { starts, end: t };
  };
  const { end } = startTimes(tracks);

  return (
    <main className="page">
      <header>
        <h1>Accessible Sortable List</h1>
        <p className="lead">
          Drag a row by its handle, or Tab to a handle and press Space. Arrows move it, Space drops,
          Escape puts it back. Every step is announced to screen readers.
        </p>
      </header>

      <section className="card" aria-labelledby="backlog-heading">
        <h2 id="backlog-heading">Sprint priorities</h2>
        <SortableList
          label="Sprint priorities"
          items={tasks}
          getKey={(t) => t.id}
          getLabel={(t) => t.title}
          onReorder={(from, to) => {
            setTasks((list) => arrayMove(list, from, to));
            setLastMove(`Moved “${tasks[from].title}” from #${from + 1} to #${to + 1}.`);
          }}
          renderItem={(task, { index }) => (
            <div className="task">
              <span className="task__rank">#{index + 1}</span>
              <div>
                <p className="task__title">{task.title}</p>
                {task.note && <p className="task__note">{task.note}</p>}
              </div>
              <span className="tag" data-tag={task.tag}>
                {task.tag}
              </span>
            </div>
          )}
        />
        <p className="footnote">{lastMove ?? "Rows have different heights on purpose."}</p>
      </section>

      <section className="card" aria-labelledby="setlist-heading">
        <h2 id="setlist-heading">Friday set list</h2>
        <SortableList
          label="Set list"
          items={tracks}
          getKey={(t) => t.id}
          getLabel={(t) => t.title}
          onReorder={(from, to) => setTracks((list) => arrayMove(list, from, to))}
          renderItem={(track, { order }) => {
            // `order` is the drag preview, so start times update while the row is still moving.
            const start = startTimes(order).starts.get(track.id) ?? DOORS_OPEN;
            return (
              <div className="track">
                <time className="track__start">{clock(start)}</time>
                <div>
                  <p className="track__title">{track.title}</p>
                  <p className="track__artist">{track.artist}</p>
                </div>
                <span className="track__length">{duration(track.seconds)}</span>
              </div>
            );
          }}
        />
        <p className="footnote">
          Doors at {clock(DOORS_OPEN)}, last note at {clock(end)}.
        </p>
      </section>
    </main>
  );
}
