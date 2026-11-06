// 03 · Counting words in languages that don't use spaces.
const splitCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function wordCount(text: string, locale: string): number {
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  let count = 0;
  // `isWordLike` is false for spaces and punctuation, true for words and numbers.
  for (const s of segmenter.segment(text)) if (s.isWordLike) count++;
  return count;
}

const texts: Array<[locale: string, text: string]> = [
  ["en", "Don't panic — it's only 3.5 km away!"],
  ["ja", "今日は良い天気です。"], // "The weather is nice today."
  ["th", "สวัสดีครับ ยินดีต้อนรับ"], // "Hello, welcome"
  ["zh", "我喜欢学习前端开发"], // "I like learning frontend development"
];

for (const [locale, text] of texts) {
  console.log(locale, "split:", splitCount(text), "segmenter:", wordCount(text, locale));
}
// → en split: 8 segmenter: 7   ("—" isn't a word; "Don't" and "3.5" stay whole)
// → ja split: 1 segmenter: 5
// → th split: 2 segmenter: 4
// → zh split: 1 segmenter: 5   (exact splits depend on the ICU dictionary)

// Sentence granularity exists too, but it is rule-based, not magic:
const sentences = new Intl.Segmenter("en", { granularity: "sentence" });
console.log(Array.from(sentences.segment("Dr. Smith arrived. He sat down! Ok?"), (s) => s.segment));
// → [ 'Dr. ', 'Smith arrived. ', 'He sat down! ', 'Ok?' ]
// Abbreviations like "Dr." still break a sentence. Good enough for a reading-time
// estimate, not for anything that needs real linguistic accuracy.
