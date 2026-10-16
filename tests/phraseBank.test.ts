import { beforeAll, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  PHRASE_BANK,
  PHRASE_BANK_WORDS,
  PHRASE_BANK_MANIFEST,
  registerPhraseBank,
} from "../src/phraseBank";
import {
  validPhrase,
  validWord,
  makeWord,
  emptyStore,
  removeWord,
  createBackup,
  parseBackup,
} from "../src/domain";
import { canPractice, optionsFor, maskedDefinition } from "../src/learning";
beforeAll(() =>
  registerPhraseBank(
    JSON.parse(
      readFileSync(
        new URL("../src/generated/phrase-bank.json", import.meta.url),
        "utf8",
      ),
    ),
  ),
);
it("has an intact licensed bank of more than 5,000 distinct multiword senses", () => {
  expect(PHRASE_BANK.length).toBe(PHRASE_BANK_MANIFEST.phrases);
  expect(PHRASE_BANK.length).toBeGreaterThan(5000);
  expect(new Set(PHRASE_BANK.map((p) => p.id)).size).toBe(PHRASE_BANK.length);
  expect(PHRASE_BANK.every(validPhrase)).toBe(true);
  const bytes = readFileSync(
    new URL("../public/data/phrase-bank.json", import.meta.url),
  );
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    PHRASE_BANK_MANIFEST.sha256,
  );
});
it("every dictionary phrase is a valid practice card without invented illustrations or examples", () => {
  for (const w of PHRASE_BANK_WORDS) {
    expect(validWord(w), w.id).toBe(true);
    expect(canPractice(w), w.id).toBe(true);
    expect(
      maskedDefinition(w).match(/[a-z]{2,}/gi)?.length,
      w.id,
    ).toBeGreaterThanOrEqual(3);
    expect(
      optionsFor(w, [], () => 0.5),
      w.id,
    ).toHaveLength(4);
    expect(w.concept).toBe("");
    expect(w.exampleRu).toBe("");
  }
}, 20000);
it("keeps phrase source links and removal consistent across a complete backup", () => {
  const p = PHRASE_BANK.find((p) => p.text === "fall asleep")!;
  expect(p).toBeDefined();
  const w = { ...makeWord(p.text, p.translation), sourcePhraseId: p.id };
  expect(w.bankId).toBe(p.bankId);
  expect(w.definition).toBe(p.definition);
  const s = { ...emptyStore(), words: [w], phraseIds: [p.id] };
  expect(parseBackup(createBackup(s))).toEqual(s);
  expect(removeWord(s, w.id).phraseIds).toEqual([]);
  expect(PHRASE_BANK.some((p) => p.quote)).toBe(false);
});
