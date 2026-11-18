import type { TreeNode } from "./tree";

const file = (dir: string, name: string): TreeNode => ({ id: `${dir}/${name}`, label: name });

const folder = (dir: string, name: string, children: (path: string) => TreeNode[]): TreeNode => {
  const path = `${dir}/${name}`;
  return { id: path, label: name, children: children(path) };
};

/** A lazy folder: expandable, but its contents only arrive from `loadDemoChildren`. */
const remote = (dir: string, name: string): TreeNode => ({ id: `${dir}/${name}`, label: name, hasChildren: true });

export const demoTree: TreeNode[] = [
  folder("", "storefront", (root) => [
    folder(root, "src", (src) => [
      folder(src, "components", (c) => [
        file(c, "Button.tsx"),
        file(c, "CartDrawer.tsx"),
        file(c, "ProductCard.tsx"),
        file(c, "SearchBar.tsx"),
      ]),
      folder(src, "hooks", (h) => [file(h, "useCart.ts"), file(h, "useDebounce.ts"), file(h, "useMediaQuery.ts")]),
      folder(src, "routes", (r) => [
        file(r, "checkout.tsx"),
        file(r, "index.tsx"),
        folder(r, "products", (p) => [file(p, "$id.tsx"), file(p, "index.tsx")]),
      ]),
      file(src, "main.tsx"),
      file(src, "styles.css"),
    ]),
    folder(root, "public", (p) => [file(p, "favicon.svg"), file(p, "robots.txt")]),
    remote(root, "node_modules"),
    remote(root, "shared-drive"),
    remote(root, "drafts"),
    file(root, "package.json"),
    file(root, "README.md"),
    file(root, "tsconfig.json"),
    file(root, "vite.config.ts"),
  ]),
];

export const demoExpanded = ["/storefront", "/storefront/src"];

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    });
  });

const packages = ["@vitejs/plugin-react", "react", "react-dom", "typescript", "vite", "zod"];
let sharedDriveAttempts = 0;

/**
 * Fake backend for the lazy folders: node_modules is slow, shared-drive fails on the first try,
 * drafts is empty, and every package folder inside node_modules is lazy again.
 */
export async function loadDemoChildren(node: TreeNode, signal: AbortSignal): Promise<TreeNode[]> {
  const name = node.label;
  if (name === "node_modules") {
    await delay(900, signal);
    return packages.map((pkg) => remote(node.id, pkg));
  }
  if (name === "shared-drive") {
    await delay(600, signal);
    sharedDriveAttempts += 1;
    if (sharedDriveAttempts === 1) throw new Error("Network timeout");
    return [file(node.id, "brand-guidelines.pdf"), file(node.id, "q4-roadmap.md"), file(node.id, "logo.svg")];
  }
  if (name === "drafts") {
    await delay(400, signal);
    return [];
  }
  await delay(500, signal);
  return [file(node.id, "package.json"), file(node.id, "README.md"), remote(node.id, "dist")];
}
