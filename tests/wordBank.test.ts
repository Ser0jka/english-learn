import { beforeAll, describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  registerWordBank,
  WORD_BANK,
  WORD_BANK_MANIFEST,
  NEW_SESSION_SIZE,
  bankEntry,
  findBankWord,
} from "../src/wordBank";
import { CATALOG } from "../src/data";
import {
  acceptedAnswers,
  canPractice,
  maskedDefinition,
  meaningKey,
  optionsFor,
  queueFor,
  studySessionFor,
} from "../src/learning";
import {
  validWord,
  emptyStore,
  recordPractice,
  createBackup,
  parseBackup,
  makeWord,
} from "../src/domain";
beforeAll(() =>
  registerWordBank(
    JSON.parse(
      readFileSync(
        new URL("../src/generated/word-bank.json", import.meta.url),
        "utf8",
      ),
    ),
  ),
);
describe("10,000 dictionary cards", () => {
  it("has exactly 10,000 distinct, valid meanings with an intact pinned artifact", () => {
    expect(WORD_BANK).toHaveLength(10000);
    expect(new Set(WORD_BANK.map((w) => w.id)).size).toBe(10000);
    expect(new Set(WORD_BANK.map(meaningKey)).size).toBe(10000);
    expect(WORD_BANK.every(validWord)).toBe(true);
    const data = readFileSync(
      new URL("../src/generated/word-bank.json", import.meta.url),
    );
    expect(createHash("sha256").update(data).digest("hex")).toBe(
      WORD_BANK_MANIFEST.sha256,
    );
    expect(new Set(WORD_BANK.map((w) => w.word)).size).toBe(
      WORD_BANK_MANIFEST.uniqueHeadwords,
    );
  });
  it("every card has a meaningful masked prompt and four distinct choices without known synonyms as negatives", () => {
    const positions = new Set<number>();
    for (const [i, word] of WORD_BANK.entries()) {
      expect(canPractice(word), word.id).toBe(true);
      const prompt = maskedDefinition(word);
      expect(
        prompt.match(/[a-z]{2,}/gi)?.length,
        word.id,
      ).toBeGreaterThanOrEqual(3);
      const options = optionsFor(word, [], () => (i % 7) / 7);
      expect(options, word.id).toHaveLength(4);
      expect(new Set(options).size, word.id).toBe(4);
      expect(options, word.id).toContain(word.word);
      const aliases = acceptedAnswers(word);
      const wrong = options.filter((v) => !aliases.includes(v));
      expect(wrong.length, word.id).toBeGreaterThanOrEqual(2);
      expect(
        wrong.every((v) => bankEntry(word)!.distractors.includes(v)),
        word.id,
      ).toBe(true);
      for (const alias of aliases) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(
          new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i").test(prompt),
          word.id,
        ).toBe(false);
      }
      positions.add(options.indexOf(word.word));
    }
    expect(positions.size).toBe(4);
  }, 20000);
  it("presents short sessions and excludes existing meanings without adding unstudied cards", () => {
    const state = emptyStore();
    const session = studySessionFor(state.words, "new", ["travel"]);
    expect(session).toHaveLength(NEW_SESSION_SIZE);
    expect(state.words).toHaveLength(12);
    expect(
      queueFor([...CATALOG, WORD_BANK[0]], "new").some(
        (w) => meaningKey(w) === meaningKey(WORD_BANK[0]),
      ),
    ).toBe(false);
    const fromBank = studySessionFor(CATALOG, "new");
    expect(fromBank).toHaveLength(NEW_SESSION_SIZE);
    expect(fromBank.every((w) => !!bankEntry(w))).toBe(true);
  });
  it("credits a dictionary answer once and restores its source and independent schedule", () => {
    const card = WORD_BANK[0];
    const state = emptyStore();
    const now = 1792152000000;
    const next = recordPractice(state, card, true, now, true);
    const saved = next.words.at(-1)!;
    expect(saved.bankId).toBe(card.bankId);
    expect(saved.successes).toBe(1);
    expect(saved.dueAt).toBe(now + 86400000);
    expect(recordPractice(next, card, true, now + 1, true)).toBe(next);
    expect(parseBackup(createBackup(next))).toEqual(next);
    const failed = recordPractice(state, card, false, now, true).words.at(-1)!;
    expect(failed.dueAt).toBe(now + 300000);
    expect(failed.status).toBe("learning");
  });
  it("does not accept spoofed source IDs or transfer a new definition into a frozen assessment", () => {
    const card = WORD_BANK[0];
    expect(
      bankEntry({ ...card, translation: "не тот перевод" }),
    ).toBeUndefined();
    const updated = { ...card, definition: "A different definition." };
    expect(bankEntry(updated)).toBeUndefined();
    const state = { ...emptyStore(), words: [updated] };
    expect(recordPractice(state, card, true)).toBe(state);
    expect(validWord({ ...card, bankId: "<script>" })).toBe(false);
  });
  it("uses dictionary material only for the selected spelling and meaning", () => {
    const card = WORD_BANK[500];
    expect(findBankWord(card.word, card.translation)?.definition).toBe(
      card.definition,
    );
    expect(makeWord(card.word, card.translation).bankId).toBe(card.bankId);
    expect(
      makeWord(card.word, "совсем другое значение").bankId,
    ).toBeUndefined();
  });
});
