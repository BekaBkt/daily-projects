import type { Field, Shape } from "./infer";
import { pascalCase, propertyKey, singular } from "./naming";

export type EmitOptions = {
  rootName: string;
  declaration: "interface" | "type";
  readonly: boolean;
  exported: boolean;
};

export type EmitResult = { code: string; count: number };

/**
 * Print a shape as TypeScript declarations, root first, then nested types
 * in the order they first appear. Structurally identical objects share one name.
 */
export function emit(root: Shape, options: EmitOptions): EmitResult {
  const rootName = pascalCase(options.rootName.trim() || "Root");
  const prefix = options.exported ? "export " : "";
  const declarations: string[] = [];
  const nameBySignature = new Map<string, string>();
  const used = new Set<string>();

  const uniqueName = (base: string) => {
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}${n}`;
    used.add(name);
    return name;
  };

  const typeOf = (shape: Shape, hint: string): string => {
    switch (shape.kind) {
      case "primitive":
        return shape.name;
      case "never":
        return "unknown";
      case "array": {
        const item = typeOf(shape.of, singular(hint));
        const wrapped = shape.of.kind === "union" ? `(${item})[]` : `${item}[]`;
        return options.readonly ? `readonly ${wrapped}` : wrapped;
      }
      case "union":
        // `null` reads best at the end: `string | null`, not `null | string`.
        return shape.members
          .map((member) => typeOf(member, hint))
          .sort((a, b) => Number(a === "null") - Number(b === "null"))
          .join(" | ");
      case "object":
        return shape.fields.size === 0 ? "Record<string, unknown>" : nameObject(shape.fields, hint);
    }
  };

  const nameObject = (fields: Map<string, Field>, hint: string): string => {
    const signature = signatureOf({ kind: "object", fields });
    const existing = nameBySignature.get(signature);
    if (existing) return existing;

    const name = uniqueName(pascalCase(hint));
    nameBySignature.set(signature, name);

    // Reserve the slot before recursing so parents print above their children.
    const slot = declarations.push("") - 1;
    const lines = [...fields].map(([key, field]) => {
      const modifier = options.readonly ? "readonly " : "";
      const optional = field.optional ? "?" : "";
      return `  ${modifier}${propertyKey(key)}${optional}: ${typeOf(field.shape, key)};`;
    });
    const body = lines.join("\n");

    declarations[slot] =
      options.declaration === "interface"
        ? `${prefix}interface ${name} {\n${body}\n}`
        : `${prefix}type ${name} = {\n${body}\n};`;
    return name;
  };

  if (root.kind === "object" && root.fields.size > 0) {
    // Nothing is named yet, so the root object gets `rootName` itself.
    nameObject(root.fields, rootName);
  } else {
    // Arrays and primitives at the top level become an alias; array items
    // are named after the singular root (Users → User, Root → RootItem).
    used.add(rootName);
    const slot = declarations.push("") - 1;
    declarations[slot] = `${prefix}type ${rootName} = ${typeOf(root, rootName)};`;
  }

  return { code: declarations.join("\n\n") + "\n", count: declarations.length };
}

/** A stable structural key: key order doesn't matter, optionality does. */
function signatureOf(shape: Shape): string {
  switch (shape.kind) {
    case "primitive":
      return shape.name;
    case "never":
      return "~";
    case "array":
      return `[${signatureOf(shape.of)}]`;
    case "union":
      return shape.members.map(signatureOf).sort().join("|");
    case "object":
      return `{${[...shape.fields]
        .map(([key, field]) => `${JSON.stringify(key)}${field.optional ? "?" : ""}:${signatureOf(field.shape)}`)
        .sort()
        .join(",")}}`;
  }
}
