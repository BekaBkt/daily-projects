export interface TreeNode {
  id: string;
  label: string;
  /** Loaded children. Leave undefined for a leaf or for a node whose children load lazily. */
  children?: readonly TreeNode[];
  /** Mark a node as expandable before its children are known (lazy loading). */
  hasChildren?: boolean;
}

export interface VisibleRow {
  node: TreeNode;
  /** 1-based, matches aria-level. */
  level: number;
  parentId: string | null;
  /** 1-based, matches aria-posinset. */
  posInSet: number;
  setSize: number;
  expandable: boolean;
  expanded: boolean;
}

/** Returns the children to show for a node: inline ones, or ones loaded later. */
export type ChildrenOf = (node: TreeNode) => readonly TreeNode[] | undefined;

export const inlineChildren: ChildrenOf = (node) => node.children;

export function isExpandable(node: TreeNode, childrenOf: ChildrenOf = inlineChildren): boolean {
  if (node.hasChildren) return true;
  const kids = childrenOf(node);
  return kids !== undefined && kids.length > 0;
}

/**
 * Depth-first walk over the rows a user can currently see. Collapsed subtrees are skipped,
 * so the cost is proportional to what is on screen, not to the size of the whole tree.
 */
export function flattenVisible(
  roots: readonly TreeNode[],
  expanded: ReadonlySet<string>,
  childrenOf: ChildrenOf = inlineChildren,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (nodes: readonly TreeNode[], level: number, parentId: string | null) => {
    nodes.forEach((node, i) => {
      const expandable = isExpandable(node, childrenOf);
      const open = expandable && expanded.has(node.id);
      rows.push({
        node,
        level,
        parentId,
        posInSet: i + 1,
        setSize: nodes.length,
        expandable,
        expanded: open,
      });
      const kids = open ? childrenOf(node) : undefined;
      if (kids) walk(kids, level + 1, node.id);
    });
  };
  walk(roots, 1, null);
  return rows;
}

/** Parent id for every node whose children are known, including hidden ones. */
export function buildParentMap(
  roots: readonly TreeNode[],
  childrenOf: ChildrenOf = inlineChildren,
): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  const stack: Array<[TreeNode, string | null]> = roots.map((n) => [n, null]);
  while (stack.length > 0) {
    const [node, parent] = stack.pop()!;
    parents.set(node.id, parent);
    for (const child of childrenOf(node) ?? []) stack.push([child, node.id]);
  }
  return parents;
}

export function isDescendant(
  parents: ReadonlyMap<string, string | null>,
  id: string,
  ancestorId: string,
): boolean {
  let current = parents.get(id) ?? null;
  while (current !== null) {
    if (current === ancestorId) return true;
    current = parents.get(current) ?? null;
  }
  return false;
}

export type TreeAction =
  | { type: "focus"; id: string }
  | { type: "expand"; id: string }
  | { type: "collapse"; id: string }
  | { type: "expandMany"; ids: string[] }
  | { type: "activate"; id: string };

/**
 * Maps a key press to what the tree should do, following the WAI-ARIA tree view pattern.
 * Returns null when the key is not a navigation key (typeahead is handled separately).
 */
export function resolveKey(key: string, rows: readonly VisibleRow[], focusedId: string): TreeAction | null {
  const index = rows.findIndex((r) => r.node.id === focusedId);
  if (index === -1) return rows.length > 0 ? { type: "focus", id: rows[0].node.id } : null;
  const row = rows[index];

  switch (key) {
    case "ArrowDown":
      return index < rows.length - 1 ? { type: "focus", id: rows[index + 1].node.id } : null;
    case "ArrowUp":
      return index > 0 ? { type: "focus", id: rows[index - 1].node.id } : null;
    case "Home":
      return { type: "focus", id: rows[0].node.id };
    case "End":
      return { type: "focus", id: rows[rows.length - 1].node.id };
    case "ArrowRight":
      if (!row.expandable) return null;
      if (!row.expanded) return { type: "expand", id: row.node.id };
      // Already open: step into the first child, if it has finished loading.
      return rows[index + 1]?.parentId === row.node.id ? { type: "focus", id: rows[index + 1].node.id } : null;
    case "ArrowLeft":
      if (row.expanded) return { type: "collapse", id: row.node.id };
      return row.parentId !== null ? { type: "focus", id: row.parentId } : null;
    case "Enter":
    case " ":
      return { type: "activate", id: row.node.id };
    case "*": {
      const ids = rows
        .filter((r) => r.parentId === row.parentId && r.expandable && !r.expanded)
        .map((r) => r.node.id);
      return ids.length > 0 ? { type: "expandMany", ids } : null;
    }
    default:
      return null;
  }
}

/**
 * Finds the next row whose label starts with the typed query, wrapping around.
 * Typing the same letter repeatedly ("sss") cycles through items starting with it, like a native listbox.
 * Returns -1 when nothing matches.
 */
export function typeaheadIndex(labels: readonly string[], currentIndex: number, query: string): number {
  if (labels.length === 0 || query === "") return -1;
  const q = query.toLocaleLowerCase();
  const repeated = [...q].every((ch) => ch === q[0]);
  const needle = repeated ? q[0] : q;
  // A fresh letter (or a repeated one) moves past the current row; a longer query refines it in place.
  const start = repeated ? currentIndex + 1 : currentIndex;
  for (let i = 0; i < labels.length; i++) {
    const idx = (((start + i) % labels.length) + labels.length) % labels.length;
    if (labels[idx].toLocaleLowerCase().startsWith(needle)) return idx;
  }
  return -1;
}

export function isPrintableKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  return e.key.length === 1 && e.key !== " " && e.key !== "*" && !e.ctrlKey && !e.metaKey && !e.altKey;
}
