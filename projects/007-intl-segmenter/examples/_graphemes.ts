// Shared helpers. Segmenters are cheap to use but not free to build, so create
// them once per locale/granularity and reuse them.

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The user-perceived characters of `text`. */
export function graphemes(text: string): string[] {
  return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
}

/** Number of user-perceived characters, without building an array. */
export function graphemeCount(text: string): number {
  let count = 0;
  for (const _ of graphemeSegmenter.segment(text)) count++;
  return count;
}

export { graphemeSegmenter };
