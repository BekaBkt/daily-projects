import { useState } from "react";
import { SplitPane } from "./SplitPane";

const shortcuts: Array<[string, string]> = [
  ["← → / ↑ ↓", "Move the divider (follows the text direction)"],
  ["Shift + arrow", "Move in bigger steps"],
  ["Home / End", "Minimum (collapses the sidebar) / maximum"],
  ["Enter", "Collapse or restore the sidebar"],
  ["Double-click", "Same as Enter, for the mouse"],
];

const files = ["App.tsx", "SplitPane.tsx", "split.ts", "styles.css", "main.tsx"];

const code = `export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Snap shut once the pointer passes the halfway point
const snapAt = (limits.collapsedSize + limits.min) / 2;`;

const log = [
  "$ npm run dev",
  "  VITE ready in 312 ms",
  "  ➜  Local:   http://localhost:5173/",
  "  page reload src/split.ts",
];

export function App() {
  const [rtl, setRtl] = useState(false);
  const [active, setActive] = useState(files[2]);
  const [sidebar, setSidebar] = useState({ size: 0, collapsed: false });
  const [editor, setEditor] = useState({ size: 0, collapsed: false });

  return (
    <main className="page">
      <header className="intro">
        <h1>Resizable Split Pane</h1>
        <p>
          A divider that follows the WAI-ARIA window splitter pattern: drag it, or focus it with <kbd>Tab</kbd> and use
          the keyboard. The sidebar snaps shut when dragged past half its minimum and reopens at the size it had.
        </p>
      </header>

      <div className="toolbar">
        <label className="switch">
          <input type="checkbox" checked={rtl} onChange={(event) => setRtl(event.target.checked)} />
          <span>Right-to-left layout</span>
        </label>
        <p className="readout" aria-hidden="true">
          sidebar {sidebar.collapsed ? "collapsed" : `${Math.round(sidebar.size)}%`} · editor {Math.round(editor.size)}%
        </p>
      </div>

      <div className="ide" dir={rtl ? "rtl" : "ltr"}>
        <SplitPane
          label="Resize file sidebar"
          defaultSize={24}
          min={14}
          max={45}
          collapsible
          storageKey="split-pane-demo:sidebar"
          onResize={setSidebar}
        >
          <nav className="sidebar" aria-label="Files">
            <h2 className="pane-title">Explorer</h2>
            <ul>
              {files.map((file) => (
                <li key={file}>
                  <button
                    type="button"
                    className="file"
                    aria-current={file === active ? "page" : undefined}
                    onClick={() => setActive(file)}
                  >
                    {file}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <SplitPane
            label="Resize editor and terminal"
            direction="column"
            defaultSize={68}
            min={25}
            max={88}
            storageKey="split-pane-demo:editor"
            onResize={setEditor}
          >
            <section className="editor" aria-label={`Editor: ${active}`}>
              <h2 className="pane-title">{active}</h2>
              <pre tabIndex={0} dir="ltr">
                <code>{code}</code>
              </pre>
            </section>
            <section className="terminal" aria-label="Terminal">
              <h2 className="pane-title">Terminal</h2>
              <pre tabIndex={0} dir="ltr">
                <code>{log.join("\n")}</code>
              </pre>
            </section>
          </SplitPane>
        </SplitPane>
      </div>

      <section className="help" aria-labelledby="keys-heading">
        <h2 id="keys-heading">Keyboard</h2>
        <dl>
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
    </main>
  );
}
