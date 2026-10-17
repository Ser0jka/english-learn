import manifest from "./generated/word-bank-manifest.json" with { type: "json" };
import type { Word, PartOfSpeech, Topic } from "./data";
export type BankRow = [
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
  PartOfSpeech?,
];
type Entry = { word: Word; rank: number; distractors: string[] };
export const WORD_BANK_MANIFEST = manifest;
export const NEW_SESSION_SIZE = 10;
export const WORD_BANK: Word[] = [];
const byId = new Map<string, Entry>();
const bySpelling = new Map<string, Word[]>();
const normalized = (s: string) =>
  s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const entryKey = (id: string, word: string) =>
  JSON.stringify([id, normalized(word)]);
export function registerBankRows(input: unknown): Word[] {
  if (
    !Array.isArray(input) ||
    !input.every((r: unknown) => {
      if (!Array.isArray(r) || r.length < 10) return false;
      return (
        /^\d{8}-[nvar]$/.test(r[0]) &&
        [1, 2, 3, 4].every(
          (i) => typeof r[i] === "string" && r[i].length <= 4000,
        ) &&
        r[1].length > 0 &&
        r[1].length <= 100 &&
        r[2].length > 0 &&
        r[2].length <= 300 &&
        r[3].length > 0 &&
        Array.isArray(r[5]) &&
        r[5].length <= 20 &&
        r[5].every(
          (v: unknown) =>
            typeof v === "string" && v.length > 0 && v.length <= 100,
        ) &&
        ["noun", "verb", "adjective", "adverb", "phrase"].includes(r[6]) &&
        Number.isSafeInteger(r[7]) &&
        ["everyday", "travel", "ideas"].includes(r[8]) &&
        Array.isArray(r[9]) &&
        r[9].length >= 3 &&
        r[9].length <= 20 &&
        r[9].every(
          (v: unknown) =>
            typeof v === "string" && v.length > 0 && v.length <= 100,
        )
      );
    })
  )
    throw new Error("Не удалось прочитать словарную базу.");
  const data = input as BankRow[];
  const result = data.map((r, i): Word => ({
    id: `wn30-${r[0]}-${r[1]}`,
    bankId: r[0],
    word: r[1],
    translation: r[2],
    definition: r[3],
    example: r[4],
    exampleRu: "",
    phonetic: "",
    synonyms: [...r[5]],
    partOfSpeech: r[6],
    topic: r[8],
    level: "—",
    concept: "",
    status: "learning",
    successes: 0,
    dueAt: 0,
    addedAt: 1000 + i,
  }));
  if (new Set(result.map((w) => w.id)).size !== result.length)
    throw new Error("Повторяющиеся записи словаря.");
  for (const [i, word] of result.entries()) {
    byId.set(entryKey(word.bankId!, word.word), {
      word,
      rank: data[i][7],
      distractors: data[i][9],
    });
    const list = bySpelling.get(word.word) || [];
    if (
      !list.some(
        (w) => w.bankId === word.bankId && w.partOfSpeech === word.partOfSpeech,
      )
    )
      list.push(word);
    bySpelling.set(word.word, list);
  }
  return result;
}
export async function fetchBank(path: string, hash: string): Promise<unknown> {
  const digest = btoa(
    String.fromCharCode(...hash.match(/../g)!.map((v) => parseInt(v, 16))),
  );
  const response = await fetch(path, {
    cache: "no-cache",
    integrity: `sha256-${digest}`,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      "Не удалось загрузить словарь. Проверьте соединение и повторите.",
    );
  return response.json();
}
let loading: Promise<void> | undefined;
export function registerWordBank(data: unknown) {
  if (!Array.isArray(data) || data.length !== manifest.cards)
    throw new Error("Неполная словарная база.");
  if (!WORD_BANK.length) WORD_BANK.push(...registerBankRows(data));
}
export function loadWordBank(): Promise<void> {
  if (WORD_BANK.length) return Promise.resolve();
  if (!loading)
    loading = fetchBank("/data/word-bank.json", manifest.sha256)
      .then(registerWordBank)
      .finally(() => {
        loading = undefined;
      });
  return loading;
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
export function findBankMeanings(spelling: string): Word[] {
  return [...(bySpelling.get(normalized(spelling)) || [])];
}
export function bankEntry(word: Word) {
  const entry = word.bankId
    ? byId.get(entryKey(word.bankId, word.word))
    : undefined;
  return entry &&
    normalized(word.translation) === normalized(entry.word.translation) &&
    word.definition === entry.word.definition &&
    word.partOfSpeech === entry.word.partOfSpeech
    ? entry
    : undefined;
}
