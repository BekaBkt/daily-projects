import { useState } from "react";
import { TreeView } from "./TreeView";
import { demoExpanded, demoTree, loadDemoChildren } from "./demoTree";
import type { TreeNode, VisibleRow } from "./tree";

const shortcuts: Array<[string, string]> = [
  ["↑ ↓", "Previous / next visible item"],
  ["→", "Open folder, or move to its first child"],
  ["←", "Close folder, or move to its parent"],
  ["Home / End", "First / last visible item"],
  ["Enter / Space", "Select (and toggle a folder)"],
  ["*", "Open every folder at this level"],
  ["a–z", "Jump to the next item starting with the typed text"],
];

function FileIcon({ row }: { row: VisibleRow }) {
  if (row.expandable) {
    return <span className="tree-icon" data-kind={row.expanded ? "folder-open" : "folder"} aria-hidden="true" />;
  }
  const ext = row.node.label.split(".").pop() ?? "";
  return <span className="tree-icon" data-kind="file" data-ext={ext} aria-hidden="true" />;
}

export function App() {
  const [selected, setSelected] = useState<{ node: TreeNode; path: TreeNode[] } | null>(null);

  return (
    <main className="page">
      <header className="intro">
        <h1>Tree View</h1>
        <p>
          A file explorer built on the WAI-ARIA tree pattern: one tab stop, full keyboard navigation, typeahead, and
          folders that load their contents on demand. Try <kbd>node_modules</kbd> (slow), <kbd>shared-drive</kbd> (fails
          once) and <kbd>drafts</kbd> (empty).
        </p>
      </header>

      <div className="layout">
        <section className="panel" aria-labelledby="explorer-heading">
          <h2 id="explorer-heading" className="panel-title">
            Explorer
          </h2>
          <TreeView
            label="Project files"
            nodes={demoTree}
            defaultExpanded={demoExpanded}
            selectedId={selected?.node.id ?? null}
            onSelect={(node, path) => setSelected({ node, path })}
            loadChildren={loadDemoChildren}
            renderIcon={(row) => <FileIcon row={row} />}
          />
        </section>

        <div className="side">
          <section className="panel" aria-labelledby="selection-heading">
            <h2 id="selection-heading" className="panel-title">
              Selection
            </h2>
            {selected ? (
              <nav aria-label="Selected path">
                <ol className="breadcrumb">
                  {selected.path.map((n, i) => (
                    <li key={n.id} aria-current={i === selected.path.length - 1 ? "location" : undefined}>
                      {n.label}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : (
              <p className="muted">Nothing selected yet.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="keys-heading">
            <h2 id="keys-heading" className="panel-title">
              Keyboard
            </h2>
            <dl className="shortcuts">
              {shortcuts.map(([keys, action]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </main>
  );
}
