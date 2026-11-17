const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Global types that a generated interface would shadow in confusing ways. */
const GLOBALS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Error",
  "Function",
  "Map",
  "Number",
  "Object",
  "Promise",
  "Record",
  "Set",
  "String",
  "Symbol",
]);

/** `user_id`, `created-at`, `HTMLParser` and `line items` all become PascalCase type names. */
export function pascalCase(raw: string): string {
  const words = raw
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean);
  const name = words.map((word) => word[0].toUpperCase() + word.slice(1)).join("");

  if (!name) return "Item";
  if (/^\d/.test(name)) return `Type${name}`;
  return GLOBALS.has(name) ? `${name}Info` : name;
}

/**
 * Good-enough English singular for naming array items:
 * categories → category, addresses → address, users → user.
 * Words that don't look plural get an `Item` suffix instead (data → DataItem).
 */
export function singular(raw: string): string {
  if (/ies$/i.test(raw) && raw.length > 4) return raw.slice(0, -3) + "y";
  if (/(ss|x|z|ch|sh)es$/i.test(raw)) return raw.slice(0, -2);
  if (/s$/i.test(raw) && !/(ss|us|is)$/i.test(raw) && raw.length > 2) return raw.slice(0, -1);
  return `${raw} item`;
}

/** Object keys are printed bare when they are identifiers, quoted otherwise. */
export function propertyKey(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}
