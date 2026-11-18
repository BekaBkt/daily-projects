import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  buildParentMap,
  flattenVisible,
  isDescendant,
  isPrintableKey,
  resolveKey,
  typeaheadIndex,
  type ChildrenOf,
  type TreeAction,
  type TreeNode,
  type VisibleRow,
} from "./tree";

type LoadState = "loading" | "error";

export interface TreeViewProps {
  /** Accessible name for the tree. */
  label: string;
  nodes: readonly TreeNode[];
  selectedId?: string | null;
  /** Called with the node and its ancestors, root first. */
  onSelect?: (node: TreeNode, path: TreeNode[]) => void;
  defaultExpanded?: Iterable<string>;
  /** Fetches children for nodes marked `hasChildren` without inline `children`. */
  loadChildren?: (node: TreeNode, signal: AbortSignal) => Promise<readonly TreeNode[]>;
  renderIcon?: (row: VisibleRow) => ReactNode;
}

const TYPEAHEAD_RESET_MS = 500;

export function TreeView({
  label,
  nodes,
  selectedId = null,
  onSelect,
  defaultExpanded,
  loadChildren,
  renderIcon,
}: TreeViewProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(defaultExpanded));
  const [loaded, setLoaded] = useState<ReadonlyMap<string, readonly TreeNode[]>>(() => new Map());
  const [loadState, setLoadState] = useState<ReadonlyMap<string, LoadState>>(() => new Map());
  const [focusedId, setFocusedId] = useState<string | null>(selectedId);
  const [announcement, setAnnouncement] = useState("");

  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const treeRef = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const typeahead = useRef({ query: "", timer: 0 });
  const controllers = useRef(new Map<string, AbortController>());

  const childrenOf = useCallback<ChildrenOf>((node) => node.children ?? loaded.get(node.id), [loaded]);
  const rows = useMemo(() => flattenVisible(nodes, expanded, childrenOf), [nodes, expanded, childrenOf]);
  const parents = useMemo(() => buildParentMap(nodes, childrenOf), [nodes, childrenOf]);
  const byId = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const stack = [...nodes];
    while (stack.length > 0) {
      const node = stack.pop()!;
      map.set(node.id, node);
      stack.push(...(childrenOf(node) ?? []));
    }
    return map;
  }, [nodes, childrenOf]);

  // The roving tab stop has to sit on a visible row. If the focused row got hidden
  // (an ancestor collapsed, or the data changed), fall back to its nearest visible ancestor.
  const activeId = useMemo(() => {
    const visible = new Set(rows.map((r) => r.node.id));
    let id = focusedId;
    while (id !== null && !visible.has(id)) id = parents.get(id) ?? null;
    return id ?? rows[0]?.node.id ?? null;
  }, [rows, focusedId, parents]);

  useLayoutEffect(() => {
    if (!moveFocus.current || activeId === null) return;
    moveFocus.current = false;
    const el = itemRefs.current.get(activeId);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  useEffect(() => {
    const pending = controllers.current;
    const ta = typeahead.current;
    return () => {
      pending.forEach((c) => c.abort());
      window.clearTimeout(ta.timer);
    };
  }, []);

  const focusRow = (id: string) => {
    moveFocus.current = true;
    setFocusedId(id);
  };

  const setLoad = (id: string, state: LoadState | null) =>
    setLoadState((prev) => {
      const next = new Map(prev);
      if (state === null) next.delete(id);
      else next.set(id, state);
      return next;
    });

  const startLoad = (node: TreeNode) => {
    if (!loadChildren || controllers.current.has(node.id)) return;
    const controller = new AbortController();
    controllers.current.set(node.id, controller);
    setLoad(node.id, "loading");
    setAnnouncement(`Loading ${node.label}…`);
    loadChildren(node, controller.signal).then(
      (children) => {
        if (controller.signal.aborted) return;
        controllers.current.delete(node.id);
        setLoaded((prev) => new Map(prev).set(node.id, children));
        setLoad(node.id, null);
        setAnnouncement(
          children.length === 0 ? `${node.label} is empty` : `${node.label} loaded, ${children.length} items`,
        );
      },
      () => {
        if (controller.signal.aborted) return;
        controllers.current.delete(node.id);
        setLoad(node.id, "error");
        // Collapse again so the next expand is a retry.
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
        setAnnouncement(`Couldn't load ${node.label}`);
      },
    );
  };

  const expand = (ids: readonly string[]) => {
    setExpanded((prev) => new Set([...prev, ...ids]));
    for (const id of ids) {
      const node = byId.get(id);
      if (node && node.hasChildren && !childrenOf(node)) startLoad(node);
    }
  };

  const collapse = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Collapsing with the mouse can hide the row that holds focus. Keep focus inside the tree.
    if (focusedId !== null && isDescendant(parents, focusedId, id)) {
      moveFocus.current = treeRef.current?.contains(document.activeElement) ?? false;
      setFocusedId(id);
    }
  };

  const toggle = (row: VisibleRow) => {
    if (!row.expandable) return;
    if (row.expanded) collapse(row.node.id);
    else expand([row.node.id]);
  };

  const select = (id: string) => {
    const node = byId.get(id);
    if (!node || !onSelect) return;
    const path = [node];
    let parent = parents.get(id) ?? null;
    while (parent !== null) {
      const p = byId.get(parent);
      if (!p) break;
      path.unshift(p);
      parent = parents.get(parent) ?? null;
    }
    onSelect(node, path);
  };

  const run = (action: TreeAction) => {
    switch (action.type) {
      case "focus":
        focusRow(action.id);
        break;
      case "expand":
        expand([action.id]);
        break;
      case "expandMany":
        expand(action.ids);
        break;
      case "collapse":
        collapse(action.id);
        break;
      case "activate": {
        select(action.id);
        const row = rows.find((r) => r.node.id === action.id);
        if (row) toggle(row);
        break;
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (activeId === null) return;

    if (isPrintableKey(e)) {
      const ta = typeahead.current;
      window.clearTimeout(ta.timer);
      ta.query += e.key;
      ta.timer = window.setTimeout(() => (ta.query = ""), TYPEAHEAD_RESET_MS);
      const current = rows.findIndex((r) => r.node.id === activeId);
      const match = typeaheadIndex(
        rows.map((r) => r.node.label),
        current,
        ta.query,
      );
      if (match !== -1) focusRow(rows[match].node.id);
      e.preventDefault();
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = resolveKey(e.key, rows, activeId);
    // Arrow keys and Space scroll the page otherwise, even when there is nothing to do.
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", " ", "Enter", "*"].includes(e.key)) {
      e.preventDefault();
    }
    if (action) run(action);
  };

  return (
    <>
      <div ref={treeRef} role="tree" aria-label={label} className="tree" onKeyDown={onKeyDown}>
        {rows.map((row) => {
          const { node } = row;
          const state = loadState.get(node.id);
          const isActive = node.id === activeId;
          const empty = row.expanded && state === undefined && (childrenOf(node)?.length ?? 0) === 0;
          return (
            <div
              key={node.id}
              ref={(el) => {
                if (el) itemRefs.current.set(node.id, el);
                else itemRefs.current.delete(node.id);
              }}
              role="treeitem"
              tabIndex={isActive ? 0 : -1}
              aria-level={row.level}
              aria-posinset={row.posInSet}
              aria-setsize={row.setSize}
              aria-expanded={row.expandable ? row.expanded : undefined}
              aria-selected={node.id === selectedId}
              aria-busy={state === "loading" || undefined}
              className="tree-item"
              style={{ "--level": row.level } as CSSProperties}
              onFocus={() => setFocusedId(node.id)}
              onClick={() => {
                setFocusedId(node.id);
                select(node.id);
                toggle(row);
              }}
            >
              <span className="tree-chevron" data-visible={row.expandable} data-open={row.expanded} aria-hidden="true" />
              {renderIcon?.(row)}
              <span className="tree-label">{node.label}</span>
              {state === "loading" && <span className="tree-spinner" aria-hidden="true" />}
              {state === "error" && <span className="tree-hint tree-hint--error">couldn't load, expand to retry</span>}
              {empty && <span className="tree-hint">empty</span>}
            </div>
          );
        })}
      </div>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </>
  );
}
