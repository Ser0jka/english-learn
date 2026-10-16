import manifest from "./generated/phrase-bank-manifest.json" with { type: "json" };
import type { Phrase, Word } from "./data";
import { fetchBank, registerBankRows, type BankRow } from "./wordBank";
import { SOURCED_PHRASE_EXAMPLES } from "./phraseContexts";
export const PHRASE_BANK_MANIFEST = manifest;
export const PHRASE_BANK: Phrase[] = [];
export const PHRASE_BANK_WORDS: Word[] = [];
export const phraseSourceId = (key: string, text: string) =>
  `wnphrase-${key}-${text.replaceAll(" ", "~")}`;
let loading: Promise<void> | undefined;
export function registerPhraseBank(input: unknown) {
  if (!Array.isArray(input) || input.length !== manifest.phrases)
    throw new Error("Неполная база выражений.");
  if (PHRASE_BANK.length) return;
  const words = registerBankRows(input);
  const rows = input as BankRow[];
  const labels = {
    noun: "Сочетание существительных",
    verb: "Глагольное сочетание",
    adjective: "Сочетание с прилагательным",
    adverb: "Наречное сочетание",
    phrase: "Сочетание",
    unknown: "Сочетание",
  };
  const phrases = words.map((w, i): Phrase => ({
    id: phraseSourceId(w.bankId!, w.word),
    bankId: w.bankId,
    dictionary: true,
    definition: w.definition,
    text: w.word,
    translation: w.translation,
    keywords: w.word.split(/[ -]/),
    frequency: 1000 + i,
    frequencyLabel: labels[rows[i][10] || "phrase"],
    usage: `${labels[rows[i][10] || "phrase"]}. Значение уточняется по английскому определению ниже. Частотность и уместность в вашей ситуации отдельно не проверены.`,
    exceptions:
      "Отдельной справки об исключениях в этой базе нет. Сверяйте с контекстом; не считайте синонимы взаимозаменяемыми во всех случаях.",
    origin: "Подтверждённой истории происхождения в этом источнике нет.",
    example: w.example,
    exampleRu: "",
    quote: SOURCED_PHRASE_EXAMPLES[`${w.bankId}:${w.word}`],
    source: {
      label: "Найти в Princeton WordNet",
      url: `https://wordnetweb.princeton.edu/perl/webwn?s=${encodeURIComponent(w.word)}`,
    },
  }));
  PHRASE_BANK_WORDS.push(...words);
  PHRASE_BANK.push(...phrases);
}
export function loadPhraseBank(): Promise<void> {
  if (PHRASE_BANK.length) return Promise.resolve();
  if (!loading)
    loading = fetchBank("/data/phrase-bank.json", manifest.sha256)
      .then(registerPhraseBank)
      .finally(() => {
        loading = undefined;
      });
  return loading;
}
