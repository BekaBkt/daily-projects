export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PrimitiveName = "string" | "number" | "boolean" | "null";

export type Field = { shape: Shape; optional: boolean };

export type Shape =
  | { kind: "primitive"; name: PrimitiveName }
  /** The element type of an empty array: nothing seen yet. */
  | { kind: "never" }
  | { kind: "array"; of: Shape }
  | { kind: "object"; fields: Map<string, Field> }
  | { kind: "union"; members: Shape[] };

const NEVER: Shape = { kind: "never" };

/** Build a shape for one JSON value. Array elements are folded together with `merge`. */
export function infer(value: JsonValue): Shape {
  if (value === null) return { kind: "primitive", name: "null" };
  if (Array.isArray(value)) {
    return { kind: "array", of: value.reduce<Shape>((acc, item) => merge(acc, infer(item)), NEVER) };
  }
  switch (typeof value) {
    case "string":
      return { kind: "primitive", name: "string" };
    case "number":
      return { kind: "primitive", name: "number" };
    case "boolean":
      return { kind: "primitive", name: "boolean" };
    default: {
      const fields = new Map<string, Field>();
      for (const [key, child] of Object.entries(value)) {
        fields.set(key, { shape: infer(child), optional: false });
      }
      return { kind: "object", fields };
    }
  }
}

/**
 * Combine two observations of the same slot into one shape.
 *
 * - objects merge field by field; a key missing on either side becomes optional
 * - arrays merge their element shapes
 * - anything else becomes a union, which keeps at most one object member
 *   and one array member so `[{a:1}, {b:2}]` gives one type, not two
 */
export function merge(a: Shape, b: Shape): Shape {
  if (a.kind === "never") return b;
  if (b.kind === "never") return a;

  if (a.kind === "union" || b.kind === "union") {
    let result: Shape = a;
    for (const member of membersOf(b)) result = addMember(membersOf(result), member);
    return result;
  }
  if (a.kind === "object" && b.kind === "object") return mergeObjects(a.fields, b.fields);
  if (a.kind === "array" && b.kind === "array") return { kind: "array", of: merge(a.of, b.of) };
  if (a.kind === "primitive" && b.kind === "primitive" && a.name === b.name) return a;

  return addMember([a], b);
}

function membersOf(shape: Shape): Shape[] {
  return shape.kind === "union" ? shape.members : [shape];
}

/** Add `next` to a union, merging it into a member of the same kind when possible. */
function addMember(current: Shape[], next: Shape): Shape {
  const members = [...current];
  const index = members.findIndex((member) => sameKind(member, next));

  if (index === -1) members.push(next);
  else members[index] = merge(members[index], next);

  return members.length === 1 ? members[0] : { kind: "union", members };
}

function sameKind(a: Shape, b: Shape): boolean {
  if (a.kind === "primitive" && b.kind === "primitive") return a.name === b.name;
  return a.kind === b.kind && (a.kind === "object" || a.kind === "array");
}

function mergeObjects(left: Map<string, Field>, right: Map<string, Field>): Shape {
  const fields = new Map<string, Field>();

  for (const [key, field] of left) {
    const other = right.get(key);
    fields.set(
      key,
      other
        ? { shape: merge(field.shape, other.shape), optional: field.optional || other.optional }
        : { shape: field.shape, optional: true },
    );
  }
  for (const [key, field] of right) {
    if (!left.has(key)) fields.set(key, { shape: field.shape, optional: true });
  }

  return { kind: "object", fields };
}
