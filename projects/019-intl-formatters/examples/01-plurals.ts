// 01 · `n === 1 ? "" : "s"` is English grammar, not pluralization.
//
// Intl.PluralRules maps a number to a CLDR category (zero, one, two, few,
// many, other). Which categories exist, and which numbers land in them,
// depends on the language. The message strings are still yours to translate;
// PluralRules only tells you which one to pick.
import { numberFormat, pluralRules } from "./_formatters";

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
  // Exact matches win over categories, like ICU MessageFormat's `=0`.
  exact?: Record<number, string>;
};

export function plural(
  locale: string,
  n: number,
  forms: PluralForms,
  options: Intl.NumberFormatOptions = {},
): string {
  const template =
    forms.exact?.[n] ??
    // The rules must see the number exactly as it will be displayed: "1"
    // and "1.0" are different categories in English.
    forms[pluralRules(locale, pickPluralOptions(options)).select(n)] ??
    forms.other;
  return template.replace("#", numberFormat(locale, options).format(n));
}

// PluralRules accepts the digit options NumberFormat uses, and nothing else.
function pickPluralOptions(options: Intl.NumberFormatOptions): Intl.PluralRulesOptions {
  const { minimumFractionDigits, maximumFractionDigits, minimumIntegerDigits } = options;
  return { minimumFractionDigits, maximumFractionDigits, minimumIntegerDigits };
}

const counts = [0, 1, 2, 5, 21, 22, 25, 101];

// ✗ The English shortcut. Fine in English, wrong in most other languages.
const naive = (n: number) => `${n} file${n === 1 ? "" : "s"}`;
console.log(counts.map(naive).join(", "));
// → 0 files, 1 file, 2 files, 5 files, 21 files, 22 files, 25 files, 101 files

// What the categories look like per language.
for (const locale of ["en", "ru", "pl", "ar", "ja"]) {
  const rules = pluralRules(locale);
  console.log(
    locale.padEnd(2),
    rules.resolvedOptions().pluralCategories.join("/").padEnd(28),
    counts.map((n) => `${n}:${rules.select(n)}`).join(" "),
  );
}
// → en one/other                    0:other 1:one 2:other 5:other 21:other 22:other 25:other 101:other
// → ru few/many/one/other           0:many 1:one 2:few 5:many 21:one 22:few 25:many 101:one
// → pl few/many/one/other           0:many 1:one 2:few 5:many 21:many 22:few 25:many 101:many
// → ar few/many/one/two/zero/other  0:zero 1:one 2:two 5:few 21:many 22:many 25:many 101:other
// → ja other                        0:other 1:other 2:other 5:other 21:other 22:other 25:other 101:other
// Note 21: "one" in Russian (21 файл), "many" in Polish (21 plików).

// ✓ Russian needs three forms, and "21" takes the singular.
const filesRu: PluralForms = {
  one: "# файл",
  few: "# файла",
  many: "# файлов",
  other: "# файла", // fractions: 1,5 файла
  exact: { 0: "нет файлов" },
};
console.log(counts.map((n) => plural("ru", n, filesRu)).join(", "));
// → нет файлов, 1 файл, 2 файла, 5 файлов, 21 файл, 22 файла, 25 файлов, 101 файл

// Decimals: in English "1.0" is plural. If the UI shows one fraction digit,
// the rules have to know, or you get "1.0 star".
const stars: PluralForms = { one: "# star", other: "# stars" };
console.log(plural("en", 1, stars), "|", plural("en", 1, stars, { minimumFractionDigits: 1 }));
// → 1 star | 1.0 stars

// Ordinals are a separate rule set: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st.
const suffix: Record<Intl.LDMLPluralRule, string> = {
  zero: "th", one: "st", two: "nd", few: "rd", many: "th", other: "th",
};
const ordinal = pluralRules("en", { type: "ordinal" });
console.log([1, 2, 3, 4, 11, 12, 13, 21, 22, 103, 111].map((n) => n + suffix[ordinal.select(n)]).join(" "));
// → 1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 103rd 111th
