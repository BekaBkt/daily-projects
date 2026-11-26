// 04 · Set methods turn multi-select logic into one-liners.
//
// The same release (ES2025) added union, intersection, difference,
// symmetricDifference, isSubsetOf, isSupersetOf and isDisjointFrom to Set.
// A table with checkboxes, a filter and a "select all" header is set algebra:
// selected ⊆ all rows, visible ⊆ all rows, and the header reflects how the
// two overlap. Before, every one of these was a filter + has loop.
import { headerState, selectRange, toggleVisible } from "./_selection";

type Row = { id: string; name: string; team: string };

const rows: Row[] = [
  { id: "u1", name: "Aigerim", team: "web" },
  { id: "u2", name: "Ben", team: "web" },
  { id: "u3", name: "Chen", team: "data" },
  { id: "u4", name: "Dana", team: "web" },
  { id: "u5", name: "Erlan", team: "data" },
];

const ids = (predicate: (row: Row) => boolean) => new Set(rows.values().filter(predicate).map((r) => r.id));
const show = (s: ReadonlySet<string>) => [...s].sort().join(",") || "∅";

let selected = new Set(["u1", "u3"]);
const webTeam = ids((r) => r.team === "web");

console.log(headerState(selected, webTeam));
// → some
selected = toggleVisible(selected, webTeam); // header click with the "web" filter on
console.log(show(selected), headerState(selected, webTeam));
// → u1,u2,u3,u4 all
selected = toggleVisible(selected, webTeam); // click again: only web rows clear
console.log(show(selected));
// → u3   (Chen is on the data team, hidden by the filter, and stays selected)

// "Hidden selection" warning: how many selected rows the filter is hiding.
const hidden = selected.difference(webTeam);
console.log(hidden.size > 0 ? `${hidden.size} selected row hidden by filter` : "");
// → 1 selected row hidden by filter

// Shift-click from Ben to Dana while Ben is being checked: the range takes
// the anchor's new state, the rest of the selection is untouched.
const shiftRange = new Set(rows.slice(1, 4).map((r) => r.id));
console.log(show(selectRange(selected, shiftRange, true)), "|", show(selectRange(selected, shiftRange, false)));
// → u2,u3,u4 | ∅

// Diffing two selections for an undo toast or an audit log.
const before = new Set(["u1", "u2", "u3"]);
const after = new Set(["u2", "u3", "u5"]);
console.log("added", show(after.difference(before)), "· removed", show(before.difference(after)));
// → added u5 · removed u1
console.log("changed", show(before.symmetricDifference(after)));
// → changed u1,u5

// The argument only has to be "set-like" (size, has, keys), so a Map works
// as the other side: which selected ids still exist after a refetch?
const refetched = new Map(rows.filter((r) => r.id !== "u3").map((r) => [r.id, r]));
console.log(show(new Set(["u3", "u5"]).intersection(refetched)));
// → u5

// The methods return new Sets and never mutate, which is exactly what React
// state updates want (see 05).
const original = new Set(["u1"]);
const next = original.union(new Set(["u2"]));
console.log(original.size, next.size, original === next);
// → 1 2 false
