import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface ComboboxProps<T> {
  label: string;
  items: readonly T[];
  value: T | null;
  onChange: (item: T | null) => void;
  /** Text shown in the input and used for matching. */
  getLabel: (item: T) => string;
  /** Stable key for each item. Defaults to the label. */
  getKey?: (item: T) => string;
  /** Custom option content. `label` already has the match highlighted. */
  renderOption?: (item: T, label: ReactNode) => ReactNode;
  placeholder?: string;
  emptyMessage?: string;
  /** Upper bound on rendered options, so huge lists stay fast. */
  maxResults?: number;
}

/** Wraps the first case-insensitive match of `query` in a <mark>. */
export function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;
  const start = text.toLowerCase().indexOf(q.toLowerCase());
  if (start === -1) return text;
  const end = start + q.length;
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/**
 * Editable combobox with list autocomplete, following the WAI-ARIA 1.2
 * combobox pattern. Focus stays in the input; the highlighted option is
 * exposed to screen readers with `aria-activedescendant`.
 */
export function Combobox<T>({
  label,
  items,
  value,
  onChange,
  getLabel,
  getKey = getLabel,
  renderOption,
  placeholder,
  emptyMessage = "No matches",
  maxResults = 50,
}: ComboboxProps<T>) {
  const id = useId();
  const inputId = `${id}-input`;
  const labelId = `${id}-label`;
  const listId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [query, setQuery] = useState(() => (value ? getLabel(value) : ""));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Keep the input text in sync when the parent changes the value.
  const selectedLabel = value ? getLabel(value) : "";
  const [syncedLabel, setSyncedLabel] = useState(selectedLabel);
  if (syncedLabel !== selectedLabel) {
    setSyncedLabel(selectedLabel);
    setQuery(selectedLabel);
  }

  const filtered = useMemo(() => {
    // When the input still shows the current selection, offer the full list.
    const q = query === selectedLabel ? "" : query.trim().toLowerCase();
    const matches = q
      ? items.filter((item) => getLabel(item).toLowerCase().includes(q))
      : items;
    return { total: matches.length, results: matches.slice(0, maxResults) };
  }, [items, query, selectedLabel, getLabel, maxResults]);
  const { total, results } = filtered;

  const active = open && activeIndex < results.length ? activeIndex : -1;
  const highlightQuery = query === selectedLabel ? "" : query;

  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
  }, [active]); // optionId only depends on `id`, which is stable

  function openList(index: number) {
    setOpen(true);
    setActiveIndex(index);
  }

  function select(item: T) {
    onChange(item);
    setQuery(getLabel(item));
    setOpen(false);
    setActiveIndex(-1);
  }

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const last = results.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open || event.altKey) {
          openList(event.altKey ? -1 : 0);
        } else if (last >= 0) {
          setActiveIndex(active >= last ? 0 : active + 1);
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          openList(last);
        } else if (last >= 0) {
          setActiveIndex(active <= 0 ? last : active - 1);
        }
        break;
      case "Enter":
        if (open && active >= 0) {
          event.preventDefault();
          select(results[active]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        } else if (query) {
          event.preventDefault();
          setQuery("");
          onChange(null);
        }
        break;
      case "Tab":
        close();
        break;
    }
  }

  function handleBlur() {
    close();
    if (query.trim() === "") {
      if (value !== null) onChange(null);
      setQuery("");
    } else {
      // Unconfirmed text reverts to the last real selection.
      setQuery(selectedLabel);
    }
  }

  return (
    <div className="combobox">
      <label id={labelId} htmlFor={inputId} className="combobox-label">
        {label}
      </label>
      <div className="combobox-field">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            openList(event.target.value.trim() ? 0 : -1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onClick={() => {
            if (!open) openList(-1);
          }}
        />
        <button
          type="button"
          className="combobox-toggle"
          tabIndex={-1}
          aria-label={`Show ${label} options`}
          aria-expanded={open}
          aria-controls={listId}
          // Keep focus in the input so blur doesn't fire.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            document.getElementById(inputId)?.focus();
            if (open) close();
            else openList(-1);
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        className="combobox-list"
        hidden={!open || results.length === 0}
      >
        {results.map((item, index) => {
          const text = getLabel(item);
          const marked = highlightMatch(text, highlightQuery);
          const selected = value !== null && getKey(value) === getKey(item);
          return (
            <li
              key={getKey(item)}
              id={optionId(index)}
              role="option"
              aria-selected={selected}
              data-active={index === active || undefined}
              className="combobox-option"
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => {
                if (index !== active) setActiveIndex(index);
              }}
              onClick={() => select(item)}
            >
              {renderOption ? renderOption(item, marked) : marked}
            </li>
          );
        })}
      </ul>

      {open && results.length === 0 && (
        <p className="combobox-empty">{emptyMessage}</p>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {open && query.trim() && query !== selectedLabel
          ? `${total} ${total === 1 ? "result" : "results"}`
          : ""}
      </div>
    </div>
  );
}
