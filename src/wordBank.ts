import rows from "./generated/word-bank.json" with { type: "json" };
import manifest from "./generated/word-bank-manifest.json" with { type: "json" };
import type { Word, PartOfSpeech, Topic } from "./data";

type Row = [
  string,
  string,
  string,
  string,
  string,
  string[],
  PartOfSpeech,
  number,
  Topic,
  string[],
];
export const WORD_BANK_MANIFEST = manifest;
export const NEW_SESSION_SIZE = 10;
export const WORD_BANK: Word[] = (rows as unknown as Row[]).map((r, i) => ({
  id: `wn30-${r[0]}`,
  bankId: r[0],
  word: r[1],
  translation: r[2],
  definition: r[3],
  example: r[4],
  exampleRu: "",
  phonetic: "",
  synonyms: r[5],
  partOfSpeech: r[6],
  topic: r[8],
  level: "—",
  concept: "",
  status: "learning",
  successes: 0,
  dueAt: 0,
  addedAt: 1000 + i,
}));
const byId = new Map(
  WORD_BANK.map((word, i) => [
    word.bankId!,
    {
      word,
      rank: (rows[i] as unknown as Row)[7],
      distractors: (rows[i] as unknown as Row)[9],
    },
  ]),
);
const normalized = (s: string) =>
  s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const bySpelling = new Map<string, Word[]>();
for (const word of WORD_BANK) {
  const list = bySpelling.get(word.word) || [];
  list.push(word);
  bySpelling.set(word.word, list);
}
export function findBankWord(spelling: string, translation = "") {
  return bySpelling
    .get(normalized(spelling))
    ?.find(
      (w) =>
        !translation.trim() ||
        normalized(w.translation) === normalized(translation),
    );
}
// An imported ID alone cannot turn arbitrary text into a ready dictionary task.
export function bankEntry(word: Word) {
  const entry = word.bankId ? byId.get(word.bankId) : undefined;
  return entry &&
    normalized(word.word) === entry.word.word &&
    normalized(word.translation) === normalized(entry.word.translation) &&
    word.definition === entry.word.definition &&
    word.partOfSpeech === entry.word.partOfSpeech
    ? entry
    : undefined;
}
