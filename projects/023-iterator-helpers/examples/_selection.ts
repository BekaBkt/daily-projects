// Selection logic shared by 04 and 05. Pure functions over ReadonlySet, so
// they work as React state updaters without copying.

export type HeaderState = "none" | "some" | "all";

/** What the "select all" checkbox in the header should show for the visible rows. */
export function headerState(selected: ReadonlySet<string>, visible: ReadonlySet<string>): HeaderState {
  if (visible.size === 0 || visible.isDisjointFrom(selected)) return "none";
  return visible.isSubsetOf(selected) ? "all" : "some";
}

/**
 * Clicking the header: if every visible row is already selected, unselect
 * them; otherwise select them. Rows hidden by the filter keep their state,
 * which is what users expect and what most hand-rolled versions get wrong.
 */
export function toggleVisible(selected: ReadonlySet<string>, visible: ReadonlySet<string>): Set<string> {
  return headerState(selected, visible) === "all" ? selected.difference(visible) : selected.union(visible);
}

/** Shift-click range selection: toggle the whole range to the anchor's new state. */
export function selectRange(selected: ReadonlySet<string>, range: ReadonlySet<string>, on: boolean): Set<string> {
  return on ? selected.union(range) : selected.difference(range);
}
