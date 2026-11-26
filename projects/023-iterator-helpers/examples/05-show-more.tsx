// 05 · A filterable, "show more" list with select-all, built on 01–04.
//
// The tempting version keeps a live iterator in a ref and calls
// `.take(20)` on it each time "Show more" is clicked. That breaks in React:
// StrictMode runs renders and effects twice, and a single-use iterator
// advanced twice skips a page (03, gotcha 1). The fix is to keep plain
// values in state (query, limit, selection) and rebuild the lazy pipeline
// from the array on every render. It's cheap because take(limit) stops early.
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { headerState, toggleVisible } from "./_selection";

type Person = { id: string; name: string; role: string };

type PeopleListProps = {
  people: readonly Person[];
  pageSize?: number;
  initialSelected?: Iterable<string>;
};

export function PeopleList({ people, pageSize = 3, initialSelected = [] }: PeopleListProps) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(pageSize);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initialSelected));
  const listRef = useRef<HTMLUListElement>(null);
  const focusIndex = useRef<number | null>(null);
  const searchId = useId();
  const statusId = useId();

  const needle = query.trim().toLocaleLowerCase();
  const matches = (p: Person) => needle === "" || p.name.toLocaleLowerCase().includes(needle);

  // Fresh pipeline per render: filter → take one extra to know if there's more.
  const page = people.values().filter(matches).take(limit + 1).toArray();
  const shown = page.slice(0, limit);
  const hasMore = page.length > limit;

  // The header checkbox acts on the rows the user can see, not on everything.
  const visible = new Set(shown.map((p) => p.id));
  const header = headerState(selected, visible);
  const hiddenSelected = selected.difference(visible).size;

  // After "Show more" commits, move focus to the first new row so keyboard
  // users continue where the new content starts instead of back at the top.
  useEffect(() => {
    if (focusIndex.current === null) return;
    listRef.current?.querySelectorAll<HTMLInputElement>("input[type=checkbox]")[focusIndex.current]?.focus();
    focusIndex.current = null;
  }, [limit]);

  function onQuery(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    setLimit(pageSize); // a new search starts from the first page
  }

  function showMore() {
    focusIndex.current = limit;
    setLimit(limit + pageSize);
  }

  function toggleOne(id: string) {
    setSelected((s) => (s.has(id) ? s.difference(new Set([id])) : s.union(new Set([id]))));
  }

  return (
    <section className="people" aria-labelledby={`${searchId}-title`}>
      <h2 id={`${searchId}-title`}>Team</h2>

      <label htmlFor={searchId}>Filter by name</label>
      <input id={searchId} type="search" value={query} onChange={onQuery} aria-describedby={statusId} />

      <label className="people__all">
        <input
          type="checkbox"
          checked={header === "all"}
          // `indeterminate` has no attribute; set it on the element. Screen
          // readers announce it as "mixed".
          ref={(el) => {
            if (el) el.indeterminate = header === "some";
          }}
          disabled={visible.size === 0}
          onChange={() => setSelected((s) => toggleVisible(s, visible))}
        />
        Select all shown
      </label>

      <ul ref={listRef} className="people__list">
        {shown.map((p) => (
          <li key={p.id}>
            <label>
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
              {p.name} <span className="people__role">{p.role}</span>
            </label>
          </li>
        ))}
      </ul>

      <p id={statusId} role="status" className="people__status">
        {shown.length === 0 ? "No matches." : `${selected.size} selected`}
        {hiddenSelected > 0 && ` (${hiddenSelected} not shown)`}
      </p>

      {hasMore && (
        <button type="button" onClick={showMore}>
          Show {pageSize} more
        </button>
      )}
    </section>
  );
}

// Focus styles and motion live in the app's stylesheet; the component relies
// on native controls, so the browser's :focus-visible ring and keyboard
// handling (Tab, Space) work without extra code. Example CSS:
export const css = `
.people input:focus-visible,
.people button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.people__list > li { transition: background-color 150ms; }
@media (prefers-reduced-motion: reduce) { .people__list > li { transition: none; } }
`;

const people: Person[] = [
  { id: "u1", name: "Aigerim", role: "Frontend" },
  { id: "u2", name: "Ben", role: "Design" },
  { id: "u3", name: "Chen", role: "Data" },
  { id: "u4", name: "Dana", role: "Frontend" },
  { id: "u5", name: "Erlan", role: "Backend" },
  { id: "u6", name: "Farida", role: "QA" },
];

// Server render to show the first page: 3 of 6 rows, "Show 3 more", and a
// header that is indeterminate because one shown row is selected. Erlan is
// selected but not on the first page, which the status line reports.
const html = renderToStaticMarkup(<PeopleList people={people} initialSelected={["u2", "u5"]} />);
console.log(html.replaceAll("><", ">\n<"));
